import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
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
 * The signed-in user's avatar, or null when the user has not created one yet
 * (GET /avatar answers 200 with null data, so "no avatar" is a success that is
 * neither retried nor reported to Sentry). Every failure, including a static
 * host's HTML 404 (thrown by api.ts as code UNKNOWN), surfaces as the query's
 * error. Never classify by HTTP status: api.ts does not expose it.
 */
export function useAvatar(): UseQueryResult<Avatar | null> {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: avatarQueryKey(user?.id),
    queryFn: async (): Promise<Avatar | null> => {
      const res = await api.get<ApiSuccess<Avatar | null>>('/avatar');
      return res.data;
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
