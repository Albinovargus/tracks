import { vi, describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { CryptoKey, JWK } from 'jose';

vi.mock('../workers/email.worker.js', () => ({
  startEmailWorkers: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/users.service.js', () => ({
  getById: vi.fn().mockResolvedValue({
    id: '550e8400-e29b-41d4-a716-446655440000',
    display_name: 'Test User',
    avatar_url: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }),
}));

import { build } from '../app.js';

const KID = 'test-signing-key';

async function signEs256(privateKey: CryptoKey, kid = KID) {
  return new SignJWT({
    sub: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('Authentication', () => {
  let app: FastifyInstance;
  let signingKey: CryptoKey;
  let publicJwk: JWK;

  beforeAll(async () => {
    const pair = await generateKeyPair('ES256');
    signingKey = pair.privateKey;
    publicJwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'ES256', use: 'sig' };

    // Serve the Supabase JWKS endpoint from the test key pair
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) {
        return Promise.resolve(Response.json({ keys: [publicJwk] }));
      }
      return realFetch(input, init);
    });

    app = await build({ logger: false });
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllGlobals();
  });

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with invalid token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 with malformed auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: {
        authorization: 'NotBearer some-token',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('accepts an asymmetric token signed by a Supabase JWKS key', async () => {
    const token = await signEs256(signingKey);
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 401 with an asymmetric token signed by an unknown key', async () => {
    const { privateKey: unknownKey } = await generateKeyPair('ES256');
    const token = await signEs256(unknownKey, 'unknown-key');
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(401);
  });
});
