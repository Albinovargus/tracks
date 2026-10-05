import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ApiErrorSchema } from '@tracks/types';
import type { ApiSuccess, Avatar, AvatarAppearance } from '@tracks/types';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../store/auth.store.js';

/**
 * Cache key for one user's avatar. Scoped by user id so a different user
 * signing in on the same device gets a fresh entry and a new GET.
 */
export function avatarQueryKey(
  userId: string | undefined,
): readonly ['avatar', string | undefined] {
  return ['avatar', userId] as const;
}

/**
 * True only when a value thrown by api.ts is the API's "no avatar yet" error.
 * Classifies by error code, never by HTTP status: api.ts does not expose the
 * status, and a static host's HTML 404 arrives as code UNKNOWN, which must
 * stay an error.
 */
export function isAvatarNotFound(err: unknown): boolean {
  const parsed = ApiErrorSchema.safeParse(err);
  return parsed.success && parsed.data.error.code === 'AVATAR_NOT_FOUND';
}

/**
 * The signed-in user's avatar. Resolves to null (a success, so it is neither
 * retried nor reported to Sentry) when the user has not created one yet.
 * Every other failure is rethrown and surfaces as the query's error.
 */
export function useAvatar(): UseQueryResult<Avatar | null> {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: avatarQueryKey(user?.id),
    queryFn: async (): Promise<Avatar | null> => {
      try {
        const res = await api.get<ApiSuccess<Avatar>>('/avatar');
        return res.data;
      } catch (err) {
        if (isAvatarNotFound(err)) return null;
        throw err;
      }
    },
    enabled: !!user,
  });
}

/**
 * Saves the full appearance with PUT /avatar. On success the saved avatar is
 * written into the user's cache entry before the caller navigates, so the
 * room shows it without another GET despite the app-wide staleTime.
 */
export function useSaveAvatar(): UseMutationResult<
  ApiSuccess<Avatar>,
  unknown,
  AvatarAppearance
> {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  return useMutation<ApiSuccess<Avatar>, unknown, AvatarAppearance>({
    mutationFn: (appearance) => api.put<ApiSuccess<Avatar>>('/avatar', appearance),
    onSuccess: (res) => {
      queryClient.setQueryData<Avatar | null>(avatarQueryKey(user?.id), res.data);
    },
  });
}
