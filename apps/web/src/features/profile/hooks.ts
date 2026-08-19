import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateProfileInput } from '@timeline/shared';
import { getMe, updateMe } from '../../lib/profile-api';

/**
 * `GET /me` is the app's profile source of truth (DynamoDB), seeded from
 * Cognito attributes on first call. Cached indefinitely — it only changes
 * through the mutation below, which writes the fresh copy straight back.
 */
export function useProfile() {
  return useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: Infinity });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateMe(input),
    onSuccess: (profile) => queryClient.setQueryData(['me'], profile),
  });
}
