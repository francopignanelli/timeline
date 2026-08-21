import { createTimelineSchema } from '@timeline/shared';
import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '@timeline/shared';
import * as repo from '../../repositories/timelines-repo';
import * as membersRepo from '../../repositories/members-repo';
import * as access from '../access/service';

/**
 * Authorization lives in `modules/access/service.ts` — every function here
 * resolves through it, so ownership and membership are decided in one place
 * (404 for anything the caller may not reach; never 403).
 */

/** Timelines the caller owns, plus the ones shared with them (AP3 ∪ AP12). */
export async function listAccessibleTimelines(userId: string): Promise<Timeline[]> {
  const [owned, memberships] = await Promise.all([
    repo.listTimelinesByOwner(userId),
    membersRepo.listMembershipsForUser(userId, 'TIMELINE'),
  ]);

  const ownedIds = new Set(owned.map((t) => t.id));
  const sharedIds = memberships.map((m) => m.resourceId).filter((id) => !ownedIds.has(id));
  const shared = await repo.batchGetTimelines(sharedIds);

  return [...owned, ...shared.values()];
}

export function getOwnTimeline(userId: string, id: string): Promise<Timeline> {
  return access.requireTimeline(userId, id, 'VIEW');
}

export function createTimeline(ownerId: string, input: CreateTimelineInput): Promise<Timeline> {
  return repo.createTimeline(ownerId, input);
}

export async function updateOwnTimeline(
  userId: string,
  id: string,
  patch: UpdateTimelineInput,
): Promise<Timeline> {
  const existing = await access.requireTimeline(userId, id, 'EDIT');

  // Same rule (and same reasoning) as `updateOwnStage`: an ongoing timeline
  // must not keep a stale end date, and the removal has to be derived here
  // because a JSON body cannot express "clear this field".
  const ongoing = patch.ongoing ?? existing.ongoing;
  const removals = ongoing ? ['end'] : [];

  // Cross-field range rules only see both sides once merged (DATA_MODEL.md).
  createTimelineSchema.parse({
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    start: patch.start ?? existing.start,
    end: ongoing ? undefined : 'end' in patch ? patch.end : existing.end,
    ongoing,
    unit: patch.unit ?? existing.unit,
    rulerVisible: patch.rulerVisible ?? existing.rulerVisible,
    visibility: patch.visibility ?? existing.visibility,
  });
  // Visibility is not settable through a general PATCH — it flows through the
  // dedicated share endpoints so the token lifecycle stays in one place.
  const { visibility: _ignored, ...safePatch } = patch;
  const { end: _dropped, ...safePatchWithoutEnd } = safePatch;
  return repo.updateTimeline(id, ongoing ? safePatchWithoutEnd : safePatch, removals);
}

/** Deleting a timeline is an owner-only act, not an editor one. */
export async function deleteOwnTimeline(userId: string, id: string): Promise<void> {
  const timeline = await access.requireTimeline(userId, id, 'MANAGE');
  if (timeline.shareToken) await repo.deleteShareToken(timeline.shareToken);
  await repo.deleteTimeline(id);
}
