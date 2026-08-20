import {
  BatchGetCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException, TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type { UserProfile, UpdateProfileInput } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';
import { conflict } from '../http-error';

interface UserItem extends UserProfile {
  PK: string;
  SK: string;
}

function toProfile(item: UserItem): UserProfile {
  const { PK: _PK, SK: _SK, ...profile } = item;
  return profile;
}

/**
 * AP2 in reverse: username → profile. Backs both `@mention` resolution and
 * invitations, so identity is always resolved server-side from a username
 * rather than trusted from a client-supplied userId (SECURITY.md).
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const claim = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: `USERNAME#${username.toLowerCase()}`, SK: 'CLAIM' },
    }),
  );
  const userId = claim.Item?.userId as string | undefined;
  return userId ? getUserProfile(userId) : null;
}

/** Resolves several usernames at once — one BatchGet for the claims, one for the profiles. */
export async function getUsersByUsernames(usernames: string[]): Promise<UserProfile[]> {
  if (usernames.length === 0) return [];
  const claims = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: {
          Keys: usernames.map((u) => ({ PK: `USERNAME#${u.toLowerCase()}`, SK: 'CLAIM' })),
        },
      },
    }),
  );
  const userIds = ((claims.Responses?.[tableName()] ?? []) as { userId?: string }[])
    .map((i) => i.userId)
    .filter((id): id is string => typeof id === 'string');
  if (userIds.length === 0) return [];

  const profiles = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: { Keys: userIds.map((id) => ({ PK: `USER#${id}`, SK: 'PROFILE' })) },
      },
    }),
  );
  return ((profiles.Responses?.[tableName()] ?? []) as UserItem[]).map(toProfile);
}

/**
 * Bounded prefix search over the username directory (GSI1, constant partition).
 * `Limit` caps the work DynamoDB does, not just the response size.
 */
export async function searchUsernamesByPrefix(
  prefix: string,
  limit: number,
): Promise<UserProfile[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': 'USERNAME', ':prefix': prefix.toLowerCase() },
      Limit: limit,
    }),
  );
  const userIds = ((res.Items ?? []) as { userId?: string }[])
    .map((i) => i.userId)
    .filter((id): id is string => typeof id === 'string');
  if (userIds.length === 0) return [];

  const profiles = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: { Keys: userIds.map((id) => ({ PK: `USER#${id}`, SK: 'PROFILE' })) },
      },
    }),
  );
  return ((profiles.Responses?.[tableName()] ?? []) as UserItem[]).map(toProfile);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const res = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: `USER#${userId}`, SK: 'PROFILE' } }),
  );
  return res.Item ? toProfile(res.Item as UserItem) : null;
}

/** AP2 + username registration integrity rule: transactional conditional put of claim + profile. */
export async function createUserProfile(profile: UserProfile): Promise<UserProfile> {
  const usernameLower = profile.username.toLowerCase();
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName(),
              Item: {
              PK: `USERNAME#${usernameLower}`,
              SK: 'CLAIM',
              userId: profile.id,
              // Constant GSI1 partition + username sort key: the only way to
              // answer a prefix search without a table scan (which the project
              // rules forbid). One hot partition is fine for a directory this
              // size; shard the key if it ever isn't.
              GSI1PK: 'USERNAME',
              GSI1SK: usernameLower,
            },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: { PK: `USER#${profile.id}`, SK: 'PROFILE', ...profile },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }),
    );
    return profile;
  } catch (err) {
    if (err instanceof TransactionCanceledException || err instanceof ConditionalCheckFailedException) {
      throw conflict('Username already taken');
    }
    throw err;
  }
}

export async function updateUserProfile(
  userId: string,
  patch: UpdateProfileInput,
): Promise<UserProfile> {
  const fields: Record<string, unknown> = { ...patch };
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
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toProfile(res.Attributes as UserItem);
}
