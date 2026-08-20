import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import type { Invitation, Member, MemberScope, Role } from '@timeline/shared';
import { ddb, tableName } from './dynamo-client';
import { conflict } from '../http-error';

/** `TIMELINE#<id>` / `MILESTONE#<id>` — the partition a scope's items live in. */
export function resourcePK(scope: MemberScope, resourceId: string): string {
  return `${scope}#${resourceId}`;
}

interface MemberItem extends Member {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

interface InvitationItem extends Invitation {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toMember(item: MemberItem): Member {
  const { PK: _p, SK: _s, GSI1PK: _g1, GSI1SK: _g2, ...member } = item;
  return member;
}

function toInvitation(item: InvitationItem): Invitation {
  const { PK: _p, SK: _s, GSI1PK: _g1, GSI1SK: _g2, ...invitation } = item;
  return invitation;
}

/** AP11: everyone with access to one resource. */
export async function listMembers(scope: MemberScope, resourceId: string): Promise<Member[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': resourcePK(scope, resourceId), ':prefix': 'MEMBER#' },
    }),
  );
  return (res.Items ?? []).map((i) => toMember(i as MemberItem));
}

export async function getMember(
  scope: MemberScope,
  resourceId: string,
  userId: string,
): Promise<Member | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: resourcePK(scope, resourceId), SK: `MEMBER#${userId}` },
    }),
  );
  return res.Item ? toMember(res.Item as MemberItem) : null;
}

/**
 * Resolves this user's membership across many resources in one call — used by
 * the authorization path, where a milestone may be reachable through several
 * timelines and checking them one at a time would mean N round trips.
 */
export async function batchGetMemberships(
  scope: MemberScope,
  resourceIds: string[],
  userId: string,
): Promise<Map<string, Member>> {
  if (resourceIds.length === 0) return new Map();
  const res = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [tableName()]: {
          Keys: resourceIds.map((id) => ({
            PK: resourcePK(scope, id),
            SK: `MEMBER#${userId}`,
          })),
        },
      },
    }),
  );
  const items = (res.Responses?.[tableName()] ?? []) as MemberItem[];
  return new Map(items.map((i) => [i.resourceId, toMember(i)]));
}

/** AP12: resources shared *with* this user (excludes the ones they own). */
export async function listMembershipsForUser(userId: string, scope: MemberScope): Promise<Member[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': `MEMBER#${scope}#` },
    }),
  );
  return (res.Items ?? []).map((i) => toMember(i as MemberItem));
}

export async function putMember(member: Member): Promise<Member> {
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        PK: resourcePK(member.scope, member.resourceId),
        SK: `MEMBER#${member.userId}`,
        GSI1PK: `USER#${member.userId}`,
        GSI1SK: `MEMBER#${member.scope}#${member.resourceId}`,
        ...member,
      },
    }),
  );
  return member;
}

export async function updateMemberRole(
  scope: MemberScope,
  resourceId: string,
  userId: string,
  role: Role,
): Promise<Member> {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: resourcePK(scope, resourceId), SK: `MEMBER#${userId}` },
      UpdateExpression: 'SET #r = :role',
      ExpressionAttributeNames: { '#r': 'role' },
      ExpressionAttributeValues: { ':role': role },
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    }),
  );
  return toMember(res.Attributes as MemberItem);
}

export async function deleteMember(
  scope: MemberScope,
  resourceId: string,
  userId: string,
): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { PK: resourcePK(scope, resourceId), SK: `MEMBER#${userId}` },
    }),
  );
}

// --- Invitations ---------------------------------------------------------

export async function listInvitationsForResource(
  scope: MemberScope,
  resourceId: string,
): Promise<Invitation[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': resourcePK(scope, resourceId), ':prefix': 'INVITE#' },
    }),
  );
  return (res.Items ?? []).map((i) => toInvitation(i as InvitationItem));
}

/** AP13: invitations addressed to this user. */
export async function listInvitationsForUser(userId: string): Promise<Invitation[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'INVITE#' },
    }),
  );
  return (res.Items ?? []).map((i) => toInvitation(i as InvitationItem));
}

export async function getInvitation(
  scope: MemberScope,
  resourceId: string,
  invitationId: string,
): Promise<Invitation | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tableName(),
      Key: { PK: resourcePK(scope, resourceId), SK: `INVITE#${invitationId}` },
    }),
  );
  return res.Item ? toInvitation(res.Item as InvitationItem) : null;
}

export async function createInvitation(invitation: Invitation): Promise<Invitation> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: {
          PK: resourcePK(invitation.scope, invitation.resourceId),
          SK: `INVITE#${invitation.id}`,
          GSI1PK: `USER#${invitation.inviteeId}`,
          GSI1SK: `INVITE#${invitation.id}`,
          ...invitation,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
    return invitation;
  } catch {
    throw conflict('Invitation already exists');
  }
}

/**
 * Accepting is one transaction: the membership is written and the invitation
 * consumed together, so an invite can never grant access twice or leave a
 * dangling PENDING row after it has been used.
 */
export async function acceptInvitation(invitation: Invitation, member: Member): Promise<void> {
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName(),
              Key: {
                PK: resourcePK(invitation.scope, invitation.resourceId),
                SK: `INVITE#${invitation.id}`,
              },
              UpdateExpression: 'SET #s = :accepted',
              ExpressionAttributeNames: { '#s': 'status' },
              ExpressionAttributeValues: { ':accepted': 'ACCEPTED', ':pending': 'PENDING' },
              ConditionExpression: 'attribute_exists(PK) AND #s = :pending',
            },
          },
          {
            Put: {
              TableName: tableName(),
              Item: {
                PK: resourcePK(member.scope, member.resourceId),
                SK: `MEMBER#${member.userId}`,
                GSI1PK: `USER#${member.userId}`,
                GSI1SK: `MEMBER#${member.scope}#${member.resourceId}`,
                ...member,
              },
            },
          },
        ],
      }),
    );
  } catch (err) {
    if (err instanceof TransactionCanceledException) {
      throw conflict('Invitation is no longer pending');
    }
    throw err;
  }
}

export async function setInvitationStatus(
  invitation: Invitation,
  status: 'DECLINED',
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: tableName(),
      Key: {
        PK: resourcePK(invitation.scope, invitation.resourceId),
        SK: `INVITE#${invitation.id}`,
      },
      UpdateExpression: 'SET #s = :status',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': status },
      ConditionExpression: 'attribute_exists(PK)',
    }),
  );
}

export async function deleteInvitation(
  scope: MemberScope,
  resourceId: string,
  invitationId: string,
): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tableName(),
      Key: { PK: resourcePK(scope, resourceId), SK: `INVITE#${invitationId}` },
    }),
  );
}
