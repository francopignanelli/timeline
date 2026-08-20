import {
  BatchGetCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type { Milestone, Stage, TimelineMilestoneRef, TimelineStageRef } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';
import { conflict, notFound } from '../http-error';

interface MilestoneLinkItem extends TimelineMilestoneRef {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}
interface StageLinkItem extends TimelineStageRef {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toMilestoneRef(item: MilestoneLinkItem): TimelineMilestoneRef {
  const { PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...ref } = item;
  return ref;
}
function toStageRef(item: StageLinkItem): TimelineStageRef {
  const { PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...ref } = item;
  return ref;
}

/** AP5: everything a Timeline references, in one query (META + link items). */
export async function listTimelineLinks(
  timelineId: string,
): Promise<{ milestoneRefs: TimelineMilestoneRef[]; stageRefs: TimelineStageRef[] }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `TIMELINE#${timelineId}` },
    }),
  );
  const items = res.Items ?? [];
  return {
    milestoneRefs: items
      .filter((i) => (i.SK as string).startsWith('MILESTONE#'))
      .map((i) => toMilestoneRef(i as MilestoneLinkItem)),
    stageRefs: items
      .filter((i) => (i.SK as string).startsWith('STAGE#'))
      .map((i) => toStageRef(i as StageLinkItem)),
  };
}

/**
 * Strips the internal key attributes before an item leaves the data layer.
 * Without this the raw `PK`/`SK`/`GSI1PK`/`GSI1SK` ride along into API
 * responses — and `GSI1PK` is `USER#<ownerId>`, which on the public read path
 * would hand an anonymous visitor the owner's identifier.
 */
function stripKeys<T>(item: Record<string, unknown>): T {
  const { PK: _p, SK: _s, GSI1PK: _g1, GSI1SK: _g2, ...rest } = item;
  return rest as T;
}

/** AP6: resolve the bodies referenced by a set of refs. */
export async function batchGetMilestones(ids: string[]): Promise<Map<string, Milestone>> {
  if (ids.length === 0) return new Map();
  const res = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: { Keys: ids.map((id) => ({ PK: `MILESTONE#${id}`, SK: 'META' })) },
      },
    }),
  );
  const items = (res.Responses?.[tableName()] ?? []).map((i) => stripKeys<Milestone>(i));
  return new Map(items.map((m) => [m.id, m]));
}

export async function batchGetStages(ids: string[]): Promise<Map<string, Stage>> {
  if (ids.length === 0) return new Map();
  const res = await ddb.send(
    new BatchGetCommand({
      RequestItems: { [tableName()]: { Keys: ids.map((id) => ({ PK: `STAGE#${id}`, SK: 'META' })) } },
    }),
  );
  const items = (res.Responses?.[tableName()] ?? []).map((i) => stripKeys<Stage>(i));
  return new Map(items.map((s) => [s.id, s]));
}

/** AP10: which Timelines reference this Milestone/Stage (deletion integrity + "Appears in N timelines"). */
export async function listMilestoneRefs(milestoneId: string): Promise<TimelineMilestoneRef[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `MILESTONE#${milestoneId}` },
    }),
  );
  return (res.Items ?? []).map((i) => toMilestoneRef(i as MilestoneLinkItem));
}

export async function listStageRefs(stageId: string): Promise<TimelineStageRef[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `STAGE#${stageId}` },
    }),
  );
  return (res.Items ?? []).map((i) => toStageRef(i as StageLinkItem));
}

/**
 * Link creation requires both ends to exist and be owned by the caller
 * (DATA_MODEL.md integrity rule) — the service layer checks ownership before
 * calling this; the transaction itself only re-checks existence + prevents
 * double-linking (409 on conflict).
 */
export async function linkMilestone(
  timelineId: string,
  milestoneId: string,
  displayOrder: number,
): Promise<TimelineMilestoneRef> {
  const ref: TimelineMilestoneRef = {
    timelineId,
    milestoneId,
    displayOrder,
    isHighlighted: false,
    isHidden: false,
    addedAt: new Date().toISOString(),
  };
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: { PK: `TIMELINE#${timelineId}`, SK: 'META' },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: { PK: `MILESTONE#${milestoneId}`, SK: 'META' },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: `TIMELINE#${timelineId}`,
                SK: `MILESTONE#${milestoneId}`,
                GSI1PK: `MILESTONE#${milestoneId}`,
                GSI1SK: `TIMELINE#${timelineId}`,
                ...ref,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
    return ref;
  } catch (err) {
    if (err instanceof TransactionCanceledException) throw conflict('Already linked or not found');
    throw err;
  }
}

export async function linkStage(
  timelineId: string,
  stageId: string,
): Promise<TimelineStageRef> {
  const ref: TimelineStageRef = {
    timelineId,
    stageId,
    isHighlighted: false,
    addedAt: new Date().toISOString(),
  };
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: { PK: `TIMELINE#${timelineId}`, SK: 'META' },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: { PK: `STAGE#${stageId}`, SK: 'META' },
              ConditionExpression: 'attribute_exists(PK)',
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: `TIMELINE#${timelineId}`,
                SK: `STAGE#${stageId}`,
                GSI1PK: `STAGE#${stageId}`,
                GSI1SK: `TIMELINE#${timelineId}`,
                ...ref,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
    return ref;
  } catch (err) {
    if (err instanceof TransactionCanceledException) throw conflict('Already linked or not found');
    throw err;
  }
}

export async function unlinkMilestone(timelineId: string, milestoneId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${timelineId}`, SK: `MILESTONE#${milestoneId}` },
    }),
  );
}

export async function unlinkStage(timelineId: string, stageId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${timelineId}`, SK: `STAGE#${stageId}` },
    }),
  );
}

export async function updateMilestoneLink(
  timelineId: string,
  milestoneId: string,
  patch: Partial<Pick<TimelineMilestoneRef, 'displayOrder' | 'isHighlighted' | 'isHidden'>>,
): Promise<TimelineMilestoneRef> {
  const { names, values, sets } = buildSet(patch);
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${timelineId}`, SK: `MILESTONE#${milestoneId}` },
      UpdateExpression: `SET ${sets}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  if (!res.Attributes) throw notFound();
  return toMilestoneRef(res.Attributes as MilestoneLinkItem);
}

export async function updateStageLink(
  timelineId: string,
  stageId: string,
  patch: Partial<Pick<TimelineStageRef, 'displayStyle' | 'isHighlighted'>>,
): Promise<TimelineStageRef> {
  const { names, values, sets } = buildSet(patch);
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `TIMELINE#${timelineId}`, SK: `STAGE#${stageId}` },
      UpdateExpression: `SET ${sets}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  if (!res.Attributes) throw notFound();
  return toStageRef(res.Attributes as StageLinkItem);
}

function buildSet(patch: Record<string, unknown>) {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(patch)
    .map(([key, value], i) => {
      names[`#f${i}`] = key;
      values[`:v${i}`] = value;
      return `#f${i} = :v${i}`;
    })
    .join(', ');
  return { names, values, sets };
}
