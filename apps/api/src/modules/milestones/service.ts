import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { CreateMilestoneInput, Milestone, UpdateMilestoneInput } from '@timeline/shared';
import * as repo from '../../repositories/milestones-repo';
import * as linksRepo from '../../repositories/links-repo';
import { ddb, tableName } from '../../repositories/dynamo-client';
import { notFound } from '../../http-error';

export function listOwnMilestones(ownerId: string): Promise<Milestone[]> {
  return repo.listMilestonesByOwner(ownerId);
}

export async function getOwnMilestone(ownerId: string, id: string): Promise<Milestone> {
  const milestone = await repo.getMilestone(id);
  if (!milestone || milestone.ownerId !== ownerId) throw notFound();
  return milestone;
}

export function createMilestone(ownerId: string, input: CreateMilestoneInput): Promise<Milestone> {
  return repo.createMilestone(ownerId, input);
}

export async function updateOwnMilestone(
  ownerId: string,
  id: string,
  patch: UpdateMilestoneInput,
): Promise<Milestone> {
  await getOwnMilestone(ownerId, id);
  return repo.updateMilestone(id, patch);
}

export function countTimelineRefs(milestoneId: string): Promise<number> {
  return linksRepo.listMilestoneRefs(milestoneId).then((refs) => refs.length);
}

/** Deletes the Milestone + all its Timeline links, transactionally (DATA_MODEL.md integrity rule). */
export async function deleteOwnMilestone(ownerId: string, id: string): Promise<void> {
  await getOwnMilestone(ownerId, id);
  const refs = await linksRepo.listMilestoneRefs(id);
  const transactItems = [
    { Delete: { TableName: tableName(), Key: { PK: `MILESTONE#${id}`, SK: 'META' } } },
    ...refs.map((ref) => ({
      Delete: {
        TableName: tableName(),
        Key: { PK: `TIMELINE#${ref.timelineId}`, SK: `MILESTONE#${id}` },
      },
    })),
  ];
  // TransactWriteItems caps at 100 items; MVP link counts are nowhere near that (DATA_MODEL.md).
  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
}
