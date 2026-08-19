import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import type { CreateMilestoneInput, Milestone, UpdateMilestoneInput } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';

interface MilestoneItem extends Milestone {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toMilestone(item: MilestoneItem): Milestone {
  const { PK: _PK, SK: _SK, GSI1PK: _GSI1PK, GSI1SK: _GSI1SK, ...milestone } = item;
  return milestone;
}

/** AP8: the "add existing" picker. */
export async function listMilestonesByOwner(ownerId: string): Promise<Milestone[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${ownerId}`, ':prefix': 'MILESTONE#' },
    }),
  );
  return (res.Items ?? []).map((item) => toMilestone(item as MilestoneItem));
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `MILESTONE#${id}`, SK: 'META' } }),
  );
  return res.Item ? toMilestone(res.Item as MilestoneItem) : null;
}

export async function createMilestone(
  ownerId: string,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  const id = ulid();
  const now = new Date().toISOString();
  const milestone: Milestone = { id, ownerId, ...input, createdAt: now, updatedAt: now };
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: `MILESTONE#${id}`,
        SK: 'META',
        GSI1PK: `USER#${ownerId}`,
        GSI1SK: `MILESTONE#${id}`,
        ...milestone,
      },
    }),
  );
  return milestone;
}

export async function updateMilestone(id: string, patch: UpdateMilestoneInput): Promise<Milestone> {
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
      Key: { PK: `MILESTONE#${id}`, SK: 'META' },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toMilestone(res.Attributes as MilestoneItem);
}

export async function deleteMilestone(id: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({ TableName: tableName(), Key: { PK: `MILESTONE#${id}`, SK: 'META' } }),
  );
}
