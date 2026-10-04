import { describe, it, expect } from 'vitest';
import {
  UserProfileSchema,
  CreateUserProfileSchema,
  UpdateUserProfileSchema,
} from '../user.schema.js';

const validProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  display_name: 'Test User',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

describe('UserProfileSchema', () => {
  it('parses valid profile', () => {
    expect(() => UserProfileSchema.parse(validProfile)).not.toThrow();
  });

  it('rejects non-uuid id', () => {
    expect(() => UserProfileSchema.parse({ ...validProfile, id: 'not-uuid' })).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => UserProfileSchema.parse({})).toThrow();
  });

  it('accepts Postgres timestamptz values with a UTC offset', () => {
    const result = UserProfileSchema.parse({
      ...validProfile,
      created_at: '2026-10-04T21:39:39.724427+00:00',
      updated_at: '2026-10-04T21:39:39.724427+00:00',
    });
    expect(result.created_at).toBe('2026-10-04T21:39:39.724427+00:00');
  });

  it('accepts null avatar_url', () => {
    const result = UserProfileSchema.parse(validProfile);
    expect(result.avatar_url).toBeNull();
  });

  it('accepts valid avatar_url', () => {
    const result = UserProfileSchema.parse({
      ...validProfile,
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(result.avatar_url).toBe('https://example.com/avatar.png');
  });

  it('rejects empty display_name', () => {
    expect(() =>
      UserProfileSchema.parse({ ...validProfile, display_name: '' }),
    ).toThrow();
  });
});

describe('CreateUserProfileSchema', () => {
  it('parses valid create input', () => {
    expect(() =>
      CreateUserProfileSchema.parse({ display_name: 'New User' }),
    ).not.toThrow();
  });

  it('rejects empty display_name', () => {
    expect(() =>
      CreateUserProfileSchema.parse({ display_name: '' }),
    ).toThrow();
  });

  it('accepts optional avatar_url', () => {
    const result = CreateUserProfileSchema.parse({
      display_name: 'User',
      avatar_url: 'https://example.com/img.png',
    });
    expect(result.avatar_url).toBe('https://example.com/img.png');
  });
});

describe('UpdateUserProfileSchema', () => {
  it('allows partial updates', () => {
    expect(() =>
      UpdateUserProfileSchema.parse({ display_name: 'Updated' }),
    ).not.toThrow();
  });

  it('allows empty object', () => {
    expect(() => UpdateUserProfileSchema.parse({})).not.toThrow();
  });

  it('rejects invalid avatar_url', () => {
    expect(() =>
      UpdateUserProfileSchema.parse({ avatar_url: 'not-a-url' }),
    ).toThrow();
  });
});
