import { vi, describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Avatar, AvatarAppearance } from '@tracks/types';

vi.mock('../workers/email.worker.js', () => ({
  startEmailWorkers: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/avatar.service.js', () => ({
  getByUserId: vi.fn(),
  upsertForUser: vi.fn(),
}));

import { build } from '../app.js';
import * as avatarService from '../services/avatar.service.js';
import { createTestToken } from './helpers.js';

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const APPEARANCE: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'auburn',
  top: 'starter-tee-blue',
  bottom: 'starter-shorts-black',
  shoes: 'starter-shoes-red',
};

const AVATAR: Avatar = {
  ...APPEARANCE,
  created_at: '2026-10-04T12:00:00.123456+00:00',
  updated_at: '2026-10-04T12:30:00.654321+00:00',
};

// What Supabase returns at runtime: the full row, including user_id.
const AVATAR_ROW = { ...AVATAR, user_id: TEST_USER_ID };

const getByUserId = vi.mocked(avatarService.getByUserId);
const upsertForUser = vi.mocked(avatarService.upsertForUser);

describe('/avatar', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    getByUserId.mockReset();
    upsertForUser.mockReset();
  });

  describe('GET /avatar', () => {
    it('returns 404 AVATAR_NOT_FOUND when the user has no avatar', async () => {
      getByUserId.mockResolvedValueOnce(null);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'GET',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AVATAR_NOT_FOUND');
      expect(body.error.message).toBe('Avatar not found');
      expect(getByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns 200 with the avatar, without user_id', async () => {
      getByUserId.mockResolvedValueOnce(AVATAR_ROW);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'GET',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(AVATAR);
      expect(getByUserId).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/avatar' });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(getByUserId).not.toHaveBeenCalled();
    });
  });

  describe('PUT /avatar', () => {
    it('upserts for the token user with the parsed body and returns 200', async () => {
      upsertForUser.mockResolvedValueOnce(AVATAR_ROW);
      const token = await createTestToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...APPEARANCE, user_id: '00000000-0000-4000-8000-000000000000' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(AVATAR);
      expect(upsertForUser).toHaveBeenCalledTimes(1);
      expect(upsertForUser).toHaveBeenCalledWith(TEST_USER_ID, APPEARANCE);
    });

    it('returns 400 FST_ERR_VALIDATION for an unknown catalog ID', async () => {
      const token = await createTestToken();

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...APPEARANCE, hair_color: 'neon-pink' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FST_ERR_VALIDATION');
      expect(upsertForUser).not.toHaveBeenCalled();
    });

    it('returns 400 FST_ERR_VALIDATION when a field is missing', async () => {
      const token = await createTestToken();
      const { shoes: _shoes, ...withoutShoes } = APPEARANCE;

      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        headers: { authorization: `Bearer ${token}` },
        payload: withoutShoes,
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FST_ERR_VALIDATION');
      expect(upsertForUser).not.toHaveBeenCalled();
    });

    it('returns 401 without auth for a valid body', async () => {
      // Body validation runs before the auth preHandler, so this body must be valid
      // for the request to reach authenticate and get a 401.
      const response = await app.inject({
        method: 'PUT',
        url: '/avatar',
        payload: APPEARANCE,
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(upsertForUser).not.toHaveBeenCalled();
    });
  });
});
