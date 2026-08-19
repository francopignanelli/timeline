import { useQuery } from '@tanstack/react-query';
import type { ContentBlock } from '@timeline/shared';
import { getViewUrls } from '../../lib/uploads-api';

/**
 * Presigned view URLs expire, so they're fetched per open rather than stored.
 * `staleTime` sits well inside the server's 15-minute TTL so a long-open modal
 * refetches before its links go dead.
 */
export function useViewUrls(blocks: ContentBlock[], enabled: boolean) {
  const keys = blocks
    .filter((b): b is Extract<ContentBlock, { s3Key: string }> => 's3Key' in b)
    .map((b) => b.s3Key)
    .sort();

  return useQuery({
    enabled: enabled && keys.length > 0,
    queryKey: ['uploads', 'view-urls', keys],
    queryFn: () => getViewUrls(keys),
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
