import { GetCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
              Item: { PK: `USERNAME#${usernameLower}`, SK: 'CLAIM', userId: profile.id },
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
