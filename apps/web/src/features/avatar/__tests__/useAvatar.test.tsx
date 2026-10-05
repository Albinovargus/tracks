import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Avatar, AvatarAppearance } from '@tracks/types';
import type { User } from '../../../lib/supabase.js';

vi.mock('../../../lib/api.js', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));

import { api } from '../../../lib/api.js';
import { useAuthStore } from '../../../store/auth.store.js';
import {
  avatarQueryKey,
  isAvatarNotFound,
  useAvatar,
  useSaveAvatar,
} from '../useAvatar.js';

const get = vi.mocked(api.get);
const put = vi.mocked(api.put);

function makeUser(id: string, email: string): User {
  return {
    id,
    email,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-04T12:00:00.000Z',
  };
}

const USER_A = makeUser('00000000-0000-4000-8000-00000000000a', 'a@example.test');
const USER_B = makeUser('00000000-0000-4000-8000-00000000000b', 'b@example.test');

const APPEARANCE_A: AvatarAppearance = {
  skin_tone: 'tone-3',
  hair_style: 'curly',
  hair_color: 'black',
  top: 'starter-tee-red',
  bottom: 'starter-shorts-navy',
  shoes: 'starter-shoes-white',
};

const AVATAR_A: Avatar = {
  ...APPEARANCE_A,
  created_at: '2026-10-04T12:00:00+00:00',
  updated_at: '2026-10-04T12:00:00+00:00',
};

const NOT_FOUND = {
  success: false,
  error: { code: 'AVATAR_NOT_FOUND', message: 'Avatar not found' },
};
const UNKNOWN = {
  success: false,
  error: { code: 'UNKNOWN', message: 'Not Found' },
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  get.mockReset();
  put.mockReset();
  useAuthStore.setState({ session: null, user: null });
});

afterEach(cleanup);
afterEach(() => {
  client.clear();
});

describe('avatarQueryKey', () => {
  it('scopes the key by user id', () => {
    expect(avatarQueryKey('u1')).toEqual(['avatar', 'u1']);
    expect(avatarQueryKey(undefined)).toEqual(['avatar', undefined]);
  });
});

describe('isAvatarNotFound', () => {
  it('is true only for an ApiError envelope with code AVATAR_NOT_FOUND', () => {
    expect(isAvatarNotFound(NOT_FOUND)).toBe(true);
    expect(isAvatarNotFound(UNKNOWN)).toBe(false);
    expect(isAvatarNotFound(new TypeError('Failed to fetch'))).toBe(false);
    expect(isAvatarNotFound({ code: 'AVATAR_NOT_FOUND' })).toBe(false);
    expect(isAvatarNotFound('AVATAR_NOT_FOUND')).toBe(false);
    expect(isAvatarNotFound(null)).toBe(false);
  });
});

describe('useAvatar', () => {
  it('returns the unwrapped avatar from GET /avatar', async () => {
    get.mockResolvedValue({ success: true, data: AVATAR_A });
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(AVATAR_A);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/avatar');
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
  });

  it('resolves to null (a success, not an error) for AVATAR_NOT_FOUND', async () => {
    get.mockRejectedValue(NOT_FOUND);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('is an error for an ApiError with code UNKNOWN (e.g. a static host 404 page)', async () => {
    get.mockRejectedValue(UNKNOWN);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(UNKNOWN);
    expect(result.current.data).toBeUndefined();
  });

  it('is an error when the request itself fails with a TypeError', async () => {
    const networkError = new TypeError('Failed to fetch');
    get.mockRejectedValue(networkError);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(networkError);
    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch without a signed-in user, then fetches once one signs in', async () => {
    get.mockResolvedValue({ success: true, data: AVATAR_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.fetchStatus).toBe('idle');
    expect(get).not.toHaveBeenCalled();

    act(() => {
      useAuthStore.setState({ user: USER_A });
    });

    await waitFor(() => expect(result.current.data).toEqual(AVATAR_A));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches under the new key when a different user signs in', async () => {
    get
      .mockResolvedValueOnce({ success: true, data: AVATAR_A })
      .mockRejectedValueOnce(NOT_FOUND);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(() => useAvatar(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(AVATAR_A));

    act(() => {
      useAuthStore.setState({ user: USER_B });
    });

    await waitFor(() => expect(result.current.data).toBeNull());
    expect(result.current.isSuccess).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
    expect(client.getQueryData(avatarQueryKey(USER_B.id))).toBeNull();
  });
});

describe('useSaveAvatar', () => {
  it("PUTs the appearance and writes the saved avatar into the user's cache without another GET", async () => {
    get.mockRejectedValue(NOT_FOUND);
    put.mockResolvedValue({ success: true, data: AVATAR_A });
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(
      () => ({ avatar: useAvatar(), save: useSaveAvatar() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.avatar.isSuccess).toBe(true));
    expect(result.current.avatar.data).toBeNull();

    await act(async () => {
      await result.current.save.mutateAsync(APPEARANCE_A);
    });

    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith('/avatar', APPEARANCE_A);
    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toEqual(AVATAR_A);
    await waitFor(() => expect(result.current.avatar.data).toEqual(AVATAR_A));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('leaves the cache unchanged when the save fails', async () => {
    const saveError = {
      success: false,
      error: { code: 'FST_ERR_VALIDATION', message: 'body/top must be equal to one of the allowed values' },
    };
    get.mockRejectedValue(NOT_FOUND);
    put.mockRejectedValue(saveError);
    useAuthStore.setState({ user: USER_A });

    const { result } = renderHook(
      () => ({ avatar: useAvatar(), save: useSaveAvatar() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.avatar.isSuccess).toBe(true));

    await act(async () => {
      await expect(result.current.save.mutateAsync(APPEARANCE_A)).rejects.toEqual(saveError);
    });

    expect(client.getQueryData(avatarQueryKey(USER_A.id))).toBeNull();
    expect(result.current.avatar.data).toBeNull();
  });
});
