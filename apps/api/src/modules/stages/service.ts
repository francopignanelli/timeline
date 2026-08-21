import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createStageSchema } from '@timeline/shared';
import type { ContentBlock, CreateStageInput, Stage, UpdateStageInput } from '@timeline/shared';
import * as repo from '../../repositories/stages-repo';
import * as linksRepo from '../../repositories/links-repo';
import * as membersRepo from '../../repositories/members-repo';
import { ddb, tableName } from '../../repositories/dynamo-client';
import * as access from '../access/service';
import { deleteObjects } from '../uploads/service';

function s3KeysOf(blocks: ContentBlock[] | undefined): string[] {
  return (blocks ?? []).flatMap((block) => ('s3Key' in block ? [block.s3Key] : []));
}

export function listOwnStages(ownerId: string): Promise<Stage[]> {
  return repo.listStagesByOwner(ownerId);
}

/** Stages shared *with* the caller via an accepted stage-scoped invitation (AP12). */
export async function listSharedStages(userId: string): Promise<Stage[]> {
  const memberships = await membersRepo.listMembershipsForUser(userId, 'STAGE');
  if (memberships.length === 0) return [];
  const byId = await linksRepo.batchGetStages(memberships.map((m) => m.resourceId));
  return [...byId.values()];
}

export function getOwnStage(userId: string, id: string): Promise<Stage> {
  return access.requireStage(userId, id, 'VIEW');
}

export function createStage(ownerId: string, input: CreateStageInput): Promise<Stage> {
  return repo.createStage(ownerId, input);
}

export async function updateOwnStage(
  userId: string,
  id: string,
  patch: UpdateStageInput,
): Promise<Stage> {
  const existing = await access.requireStage(userId, id, 'EDIT');
  // Cross-field range rules only see both sides once merged (DATA_MODEL.md).
  createStageSchema.parse({
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    start: patch.start ?? existing.start,
    end: 'end' in patch ? patch.end : existing.end,
    ongoing: patch.ongoing ?? existing.ongoing,
    blocks: patch.blocks ?? existing.blocks,
  });
  const updated = await repo.updateStage(id, patch);

  // Same rule as milestones: a block the user removed leaves its upload
  // behind unless something explicitly deletes it.
  if (patch.blocks) {
    const kept = new Set(s3KeysOf(patch.blocks));
    const orphaned = s3KeysOf(existing.blocks).filter((key) => !kept.has(key));
    if (orphaned.length > 0) await deleteObjects(orphaned);
  }

  return updated;
}

export function countTimelineRefs(stageId: string): Promise<number> {
  return linksRepo.listStageRefs(stageId).then((refs) => refs.length);
}

/** Deletes the Stage + all its Timeline links, transactionally (DATA_MODEL.md integrity rule). */
/** Owner-only, mirroring milestones: editors may unlink, not destroy. */
export async function deleteOwnStage(userId: string, id: string): Promise<void> {
  const stage = await repo.getStage(id);
  if (!stage || stage.ownerId !== userId) {
    await access.requireStage(userId, id, 'MANAGE');
    return;
  }
  const refs = await linksRepo.listStageRefs(id);
  const transactItems = [
    { Delete: { TableName: tableName(), Key: { PK: `STAGE#${id}`, SK: 'META' } } },
    ...refs.map((ref) => ({
      Delete: {
        TableName: tableName(),
        Key: { PK: `TIMELINE#${ref.timelineId}`, SK: `STAGE#${id}` },
      },
    })),
  ];
  await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));

  // Only after the DB delete succeeds — see the same ordering in milestones/service.ts.
  const keys = s3KeysOf(stage.blocks);
  if (keys.length > 0) await deleteObjects(keys);
}
