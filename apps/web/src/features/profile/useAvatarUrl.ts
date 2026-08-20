import { useQuery } from '@tanstack/react-query';
import { getViewUrls } from '../../lib/uploads-api';

/**
 * Presigned URL for the signed-in user's own avatar. Refreshed well inside the
 * server's 15-minute TTL so a long-lived tab never renders a dead link.
 *
 * Only ever used for *your own* avatar: presigning checks that the key sits
 * under the caller's prefix, so other people's avatars would 404. Collaborator
 * lists therefore stay on initials rather than widening that check.
 */
export function useAvatarUrl(avatarKey: string | undefined) {
  return useQuery({
    enabled: Boolean(avatarKey),
    queryKey: ['avatar', avatarKey],
    queryFn: () =>
      getViewUrls([avatarKey as string]).then((urls) => urls[avatarKey as string] ?? null),
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
