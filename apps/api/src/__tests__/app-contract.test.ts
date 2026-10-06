import { vi, describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ApiErrorSchema } from '@tracks/types';

vi.mock('../workers/email.worker.js', () => ({
  startEmailWorkers: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/users.service.js', () => ({
  getById: vi.fn().mockRejectedValue(
    Object.assign(new Error('Profile was changed by another request'), {
      statusCode: 409,
      code: 'CUSTOM',
    }),
  ),
}));

import { build } from '../app.js';
import { createTestToken } from './helpers.js';

describe('app contract', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the PUT preflight from the web dev origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/avatar',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'authorization,content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const allowMethods = String(response.headers['access-control-allow-methods'] ?? '')
      .split(',')
      .map((method) => method.trim());
    expect(allowMethods).toContain('PUT');
  });

  it('formats an error thrown inside a feature route as ApiError', async () => {
    const token = await createTestToken();
    const response = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    const body: unknown = response.json();
    expect(body).toEqual({
      success: false,
      error: { code: 'CUSTOM', message: 'Profile was changed by another request' },
    });
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it('formats a validation error on a route that declares 400: ApiErrorSchema', async () => {
    // Querystring validation runs before the authenticate preHandler, so no token is needed.
    const response = await app.inject({
      method: 'POST',
      url: '/uploads?bucket=not-a-bucket',
    });

    expect(response.statusCode).toBe(400);
    const body: unknown = response.json();
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ success: false, error: { code: 'FST_ERR_VALIDATION' } });
  });
});
