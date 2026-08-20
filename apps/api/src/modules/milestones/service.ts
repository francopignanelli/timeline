import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { CreateMilestoneInput, Mention, Milestone, UpdateMilestoneInput } from '@timeline/shared';
import { extractMentionsFromBlocks } from '@timeline/shared';
import * as repo from '../../repositories/milestones-repo';
import * as linksRepo from '../../repositories/links-repo';
import * as membersRepo from '../../repositories/members-repo';
import * as usersRepo from '../../repositories/users-repo';
import { ddb, tableName } from '../../repositories/dynamo-client';
import * as access from '../access/service';

export function listOwnMilestones(ownerId: string): Promise<Milestone[]> {
  return repo.listMilestonesByOwner(ownerId);
}

/**
 * Milestones shared *with* the caller via an accepted milestone-scoped
 * invitation (AP12). Kept separate from the owned list so the UI can present
 * "mine" and "shared with me" as distinct groups rather than one merged pile.
 */
export async function listSharedMilestones(userId: string): Promise<Milestone[]> {
  const memberships = await membersRepo.listMembershipsForUser(userId, 'MILESTONE');
  if (memberships.length === 0) return [];
  const byId = await linksRepo.batchGetMilestones(memberships.map((m) => m.resourceId));
  return [...byId.values()];
}

export function getOwnMilestone(userId: string, id: string): Promise<Milestone> {
  return access.requireMilestone(userId, id, 'VIEW');
}

/**
 * Resolves `@username` text to real users at write time. Unknown handles are
 * dropped (they stay plain text at render), so a mention record can never
 * point at a user who doesn't exist (DECISIONS #37).
 */
async function resolveMentions(blocks: CreateMilestoneInput['blocks']): Promise<Mention[]> {
  const candidates = extractMentionsFromBlocks(blocks);
  if (candidates.length === 0) return [];
  const users = await usersRepo.getUsersByUsernames(candidates);
  return users.map((u) => ({ userId: u.id, username: u.username }));
}

export async function createMilestone(
  ownerId: string,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  const mentions = await resolveMentions(input.blocks);
  return repo.createMilestone(ownerId, input, mentions);
}

export async function updateOwnMilestone(
  userId: string,
  id: string,
  patch: UpdateMilestoneInput,
): Promise<Milestone> {
  await access.requireMilestone(userId, id, 'EDIT');
  // Mentions are derived from block text, so they're re-resolved whenever
  // blocks change rather than trusted from the client.
  const mentions = patch.blocks ? await resolveMentions(patch.blocks) : undefined;
  return repo.updateMilestone(id, patch, mentions);
}

export function countTimelineRefs(milestoneId: string): Promise<number> {
  return linksRepo.listMilestoneRefs(milestoneId).then((refs) => refs.length);
}

/**
 * Deleting is owner-only: an editor may detach a milestone from a timeline
 * (unlink), but destroying a shared entity that other timelines still
 * reference stays with the owner.
 */
export async function deleteOwnMilestone(userId: string, id: string): Promise<void> {
  const milestone = await repo.getMilestone(id);
  if (!milestone || milestone.ownerId !== userId) {
    // Fall through to the access check so a non-owner with view rights still
    // gets a 404 rather than a distinguishable 403.
    await access.requireMilestone(userId, id, 'MANAGE');
    return;
  }

  const [refs, members] = await Promise.all([
    linksRepo.listMilestoneRefs(id),
    membersRepo.listMembers('MILESTONE', id),
  ]);
  const transactItems = [
    { Delete: { TableName: tableName(), Key: { PK: `MILESTONE#${id}`, SK: 'META' } } },
    ...refs.map((ref) => ({
      Delete: {
        TableName: tableName(),
        Key: { PK: `TIMELINE#${ref.timelineId}`, SK: `MILESTONE#${id}` },
      },
    })),
    // Memberships die with the resource they grant access to.
    ...members.map((m) => ({
      Delete: {
        TableName: tableName(),
        Key: { PK: `MILESTONE#${id}`, SK: `MEMBER#${m.userId}` },
      },
    })),
  ];
  // TransactWriteItems caps at 100 items; MVP link counts are nowhere near that (DATA_MODEL.md).
  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
}
