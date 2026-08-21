import { DeleteCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { ContentBlock } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';

/**
 * Registers every presigned upload the moment the URL is issued, so an
 * upload that's never attached to a saved milestone/stage isn't invisible to
 * cleanup. `ttl` is a backstop only — it reclaims this small tracking record
 * if the cleanup job never runs, but never deletes the S3 object itself; only
 * `runUploadCleanup` does that, after cross-checking current content.
 */
export async function trackPendingUpload(
  userId: string,
  key: string,
  graceDays: number,
): Promise<void> {
  const now = Date.now();
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `UPLOAD#${key}`,
        SK: 'META',
        key,
        uploadedBy: userId,
        createdAt: new Date(now).toISOString(),
        // Generous multiple of the grace period: only a safety net for a
        // cleanup job that never ran, not the primary deletion path.
        ttl: Math.floor(now / 1000) + graceDays * 4 * 24 * 60 * 60,
      },
    }),
  );
}

export interface PendingUpload {
  key: string;
  uploadedBy: string;
  createdAt: string;
}

async function scanAll<T>(
  filterExpression: string,
  values: Record<string, unknown>,
  map: (item: Record<string, unknown>) => T,
): Promise<T[]> {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName(),
        FilterExpression: filterExpression,
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) items.push(map(item));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Every upload still in the registry — a scan is fine at this app's scale (COSTS.md). */
export function scanPendingUploads(): Promise<PendingUpload[]> {
  return scanAll(
    'begins_with(PK, :p) AND SK = :sk',
    { ':p': 'UPLOAD#', ':sk': 'META' },
    (item) => ({
      key: item.key as string,
      uploadedBy: item.uploadedBy as string,
      createdAt: item.createdAt as string,
    }),
  );
}

export async function deletePendingUploadRecords(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      ddb.send(new DeleteCommand({ TableName: tableName(), Key: { PK: `UPLOAD#${key}`, SK: 'META' } })),
    ),
  );
}

/**
 * The authoritative set of S3 keys any live Milestone or Stage currently
 * references. Computed fresh at cleanup time (not from a cached "confirmed"
 * flag some write path might have missed) — this is the check that makes it
 * safe to ever delete anything: a key in this set is never touched.
 */
export async function collectReferencedS3Keys(): Promise<Set<string>> {
  const items = await scanAll(
    '(begins_with(PK, :m) OR begins_with(PK, :s)) AND SK = :meta',
    { ':m': 'MILESTONE#', ':s': 'STAGE#', ':meta': 'META' },
    (item) => (item.blocks as ContentBlock[] | undefined) ?? [],
  );
  const keys = new Set<string>();
  for (const blocks of items) {
    for (const block of blocks) {
      if ('s3Key' in block) keys.add(block.s3Key);
    }
  }
  return keys;
}
