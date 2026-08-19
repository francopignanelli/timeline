import { createTimelineSchema } from '@timeline/shared';
import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '@timeline/shared';
import * as repo from '../../repositories/timelines-repo';
import { notFound } from '../../http-error';

/**
 * MVP authorization rule (SECURITY.md): strict ownership. 404 for "exists but
 * not yours" — never leak resource existence to a non-owner.
 */

export function listOwnTimelines(ownerId: string): Promise<Timeline[]> {
  return repo.listTimelinesByOwner(ownerId);
}

export async function getOwnTimeline(ownerId: string, id: string): Promise<Timeline> {
  const timeline = await repo.getTimeline(id);
  if (!timeline || timeline.ownerId !== ownerId) throw notFound();
  return timeline;
}

export function createTimeline(ownerId: string, input: CreateTimelineInput): Promise<Timeline> {
  return repo.createTimeline(ownerId, input);
}

export async function updateOwnTimeline(
  ownerId: string,
  id: string,
  patch: UpdateTimelineInput,
): Promise<Timeline> {
  const existing = await getOwnTimeline(ownerId, id);
  // Cross-field range rules only see both sides once merged (DATA_MODEL.md).
  createTimelineSchema.parse({
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    start: patch.start ?? existing.start,
    end: 'end' in patch ? patch.end : existing.end,
    ongoing: patch.ongoing ?? existing.ongoing,
    unit: patch.unit ?? existing.unit,
    rulerVisible: patch.rulerVisible ?? existing.rulerVisible,
    visibility: patch.visibility ?? existing.visibility,
  });
  return repo.updateTimeline(id, patch);
}

export async function deleteOwnTimeline(ownerId: string, id: string): Promise<void> {
  await getOwnTimeline(ownerId, id);
  await repo.deleteTimeline(id);
}
