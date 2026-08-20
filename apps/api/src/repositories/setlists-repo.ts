import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LIMITS } from '@timeline/shared';
import type { SetlistData } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';

/**
 * Cached setlist.fm responses. Setlists are effectively immutable once
 * published, so this both honours their "don't re-fetch on every page load"
 * guidance and keeps us far inside their rate limit.
 *
 * Entries carry a `ttl` attribute so DynamoDB expires them on its own — no
 * sweeper to write, and the cache can't grow without bound. Domain items have
 * no `ttl`, so they're untouched by it.
 */
interface SetlistCacheItem {
  PK: string;
  SK: string;
  data: SetlistData;
  fetchedAt: string;
  ttl: number;
}

export async function getCachedSetlist(id: string): Promise<SetlistData | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `SETLIST#${id}`, SK: 'CACHE' } }),
  );
  const item = res.Item as SetlistCacheItem | undefined;
  if (!item) return null;
  // DynamoDB deletes expired items lazily, so re-check rather than trusting
  // that an item still present is still fresh.
  if (item.ttl * 1000 <= Date.now()) return null;
  return item.data;
}

export async function putCachedSetlist(id: string, data: SetlistData): Promise<void> {
  const ttlSeconds = Math.floor(Date.now() / 1000) + LIMITS.SETLIST_CACHE_DAYS * 24 * 60 * 60;
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `SETLIST#${id}`,
        SK: 'CACHE',
        data,
        fetchedAt: new Date().toISOString(),
        ttl: ttlSeconds,
      } satisfies SetlistCacheItem,
    }),
  );
}
