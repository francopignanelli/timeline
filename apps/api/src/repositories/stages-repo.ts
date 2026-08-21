import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import type { CreateStageInput, Stage, UpdateStageInput } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';

interface StageItem extends Stage {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toStage(item: StageItem): Stage {
  const { PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...stage } = item;
  return stage;
}

/** AP9: the "add existing" picker. */
export async function listStagesByOwner(ownerId: string): Promise<Stage[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${ownerId}`, ':prefix': 'STAGE#' },
    }),
  );
  return (res.Items ?? []).map((item) => toStage(item as StageItem));
}

export async function getStage(id: string): Promise<Stage | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `STAGE#${id}`, SK: 'META' } }),
  );
  return res.Item ? toStage(res.Item as StageItem) : null;
}

export async function createStage(ownerId: string, input: CreateStageInput): Promise<Stage> {
  const id = ulid();
  const now = new Date().toISOString();
  const stage: Stage = { id, ownerId, ...input, createdAt: now, updatedAt: now };
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `STAGE#${id}`,
        SK: 'META',
        GSI1PK: `USER#${ownerId}`,
        GSI1SK: `STAGE#${id}`,
        ...stage,
      },
    }),
  );
  return stage;
}

/**
 * `remove` deletes attributes outright. A PATCH body cannot ask for this on
 * its own — `JSON.stringify` drops an `undefined` value, so "clear this
 * field" and "leave it alone" arrive identical — so the caller derives the
 * removal and states it explicitly (see `updateOwnStage` clearing `end`).
 */
export async function updateStage(
  id: string,
  patch: UpdateStageInput,
  remove: readonly string[] = [],
): Promise<Stage> {
  const fields: Record<string, unknown> = { ...patch, updatedAt: new Date().toISOString() };
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(fields).map(([key, value], i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });
  const removes = remove.map((key, i) => {
    names[`#r${i}`] = key;
    return `#r${i}`;
  });

  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `STAGE#${id}`, SK: 'META' },
      UpdateExpression:
        `SET ${sets.join(', ')}` + (removes.length > 0 ? ` REMOVE ${removes.join(', ')}` : ''),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toStage(res.Attributes as StageItem);
}

export async function deleteStage(id: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: tableName(), Key: { PK: `STAGE#${id}`, SK: 'META' } }));
}
