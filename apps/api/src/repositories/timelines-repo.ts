import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';

interface TimelineItem extends Timeline {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toTimeline(item: TimelineItem): Timeline {
  const { PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...timeline } = item;
  return timeline;
}

export async function listTimelinesByOwner(ownerId: string): Promise<Timeline[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${ownerId}`, ':prefix': 'TIMELINE#' },
    }),
  );
  return (res.Items ?? []).map((item) => toTimeline(item as TimelineItem));
}

export async function getTimeline(id: string): Promise<Timeline | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `TIMELINE#${id}`, SK: 'META' } }),
  );
  return res.Item ? toTimeline(res.Item as TimelineItem) : null;
}

/** Resolves many timelines at once — used by the authorization path and by AP12. */
export async function batchGetTimelines(ids: string[]): Promise<Map<string, Timeline>> {
  if (ids.length === 0) return new Map();
  const res = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: { Keys: ids.map((id) => ({ PK: `TIMELINE#${id}`, SK: 'META' })) },
      },
    }),
  );
  const items = (res.Responses?.[tableName()] ?? []) as TimelineItem[];
  return new Map(items.map((item) => [item.id, toTimeline(item)]));
}

export async function createTimeline(ownerId: string, input: CreateTimelineInput): Promise<Timeline> {
  const id = ulid();
  const now = new Date().toISOString();
  const timeline: Timeline = { id, ownerId, ...input, createdAt: now, updatedAt: now };
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `TIMELINE#${id}`,
        SK: 'META',
        GSI1PK: `USER#${ownerId}`,
        GSI1SK: `TIMELINE#${id}`,
        ...timeline,
      },
    }),
  );
  return timeline;
}

export async function updateTimeline(id: string, patch: UpdateTimelineInput): Promise<Timeline> {
  const fields: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(fields).map(([key, value], i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${id}`, SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toTimeline(res.Attributes as TimelineItem);
}

/**
 * Visibility + token in one write. Separate from `updateTimeline` because
 * clearing a token needs REMOVE, which the generic SET-only patch builder
 * cannot express — a lingering attribute here would mean a revoked link
 * still resolved.
 */
export async function setTimelineShare(
  id: string,
  visibility: Timeline['visibility'],
  shareToken: string | null,
): Promise<Timeline> {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${id}`, SK: 'META' },
      UpdateExpression: shareToken
        ? 'SET visibility = :v, shareToken = :t, updatedAt = :u'
        : 'SET visibility = :v, updatedAt = :u REMOVE shareToken',
      ExpressionAttributeValues: shareToken
        ? { ':v': visibility, ':t': shareToken, ':u': new Date().toISOString() }
        : { ':v': visibility, ':u': new Date().toISOString() },
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toTimeline(res.Attributes as TimelineItem);
}

/**
 * AP14: share token → timelineId. A separate claim item (mirroring the
 * username claim) so a token can be rotated to revoke a leaked link without
 * touching the timeline's identity.
 */
export async function getTimelineIdByShareToken(token: string): Promise<string | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `SHARE#${token}`, SK: 'CLAIM' } }),
  );
  return (res.Item?.timelineId as string | undefined) ?? null;
}

export async function putShareToken(token: string, timelineId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: { PK: `SHARE#${token}`, SK: 'CLAIM', timelineId },
    }),
  );
}

export async function deleteShareToken(token: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({ TableName: tableName(), Key: { PK: `SHARE#${token}`, SK: 'CLAIM' } }),
  );
}

/** Deletes META + any link items under the Timeline partition (AP5 shape). No Milestones/Stages touched. */
export async function deleteTimeline(id: string): Promise<void> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `TIMELINE#${id}` },
    }),
  );
  const items = res.Items ?? [];
  await Promise.all(
    items.map((item) =>
      ddb.send(
        new DeleteCommand({ TableName: tableName(), Key: { PK: item.PK, SK: item.SK } }),
      ),
    ),
  );
}
