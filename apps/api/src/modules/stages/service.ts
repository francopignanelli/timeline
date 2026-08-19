import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createStageSchema } from '@timeline/shared';
import type { CreateStageInput, Stage, UpdateStageInput } from '@timeline/shared';
import * as repo from '../../repositories/stages-repo';
import * as linksRepo from '../../repositories/links-repo';
import { ddb, tableName } from '../../repositories/dynamo-client';
import { notFound } from '../../http-error';

export function listOwnStages(ownerId: string): Promise<Stage[]> {
  return repo.listStagesByOwner(ownerId);
}

export async function getOwnStage(ownerId: string, id: string): Promise<Stage> {
  const stage = await repo.getStage(id);
  if (!stage || stage.ownerId !== ownerId) throw notFound();
  return stage;
}

export function createStage(ownerId: string, input: CreateStageInput): Promise<Stage> {
  return repo.createStage(ownerId, input);
}

export async function updateOwnStage(
  ownerId: string,
  id: string,
  patch: UpdateStageInput,
): Promise<Stage> {
  const existing = await getOwnStage(ownerId, id);
  // Cross-field range rules only see both sides once merged (DATA_MODEL.md).
  createStageSchema.parse({
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    start: patch.start ?? existing.start,
    end: 'end' in patch ? patch.end : existing.end,
    ongoing: patch.ongoing ?? existing.ongoing,
  });
  return repo.updateStage(id, patch);
}

export function countTimelineRefs(stageId: string): Promise<number> {
  return linksRepo.listStageRefs(stageId).then((refs) => refs.length);
}

/** Deletes the Stage + all its Timeline links, transactionally (DATA_MODEL.md integrity rule). */
export async function deleteOwnStage(ownerId: string, id: string): Promise<void> {
  await getOwnStage(ownerId, id);
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
}
