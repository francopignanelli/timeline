import type { Capability, Milestone, Role, Stage, Timeline } from '@timeline/shared';
import { roleAllows } from '@timeline/shared';
import * as timelinesRepo from '../../repositories/timelines-repo';
import * as milestonesRepo from '../../repositories/milestones-repo';
import * as stagesRepo from '../../repositories/stages-repo';
import * as linksRepo from '../../repositories/links-repo';
import * as membersRepo from '../../repositories/members-repo';
import { notFound } from '../../http-error';

/**
 * The single authorization choke point (API.md predicted this: "the ownership
 * check widens to a role check in one place per module"). Every read and write
 * resolves access here; routes and repositories are unchanged.
 *
 * Failures are always 404, never 403 — a non-member must not be able to tell
 * an existing resource from a missing one (SECURITY.md).
 */

export interface Access<T> {
  resource: T;
  role: Role;
}

async function timelineRole(userId: string, timeline: Timeline): Promise<Role | null> {
  if (timeline.ownerId === userId) return 'OWNER';
  const member = await membersRepo.getMember('TIMELINE', timeline.id, userId);
  return member?.role ?? null;
}

export async function resolveTimelineAccess(
  userId: string,
  timelineId: string,
  capability: Capability,
): Promise<Access<Timeline> | null> {
  const timeline = await timelinesRepo.getTimeline(timelineId);
  if (!timeline) return null;

  const role = await timelineRole(userId, timeline);
  if (role && roleAllows(role, capability)) return { resource: timeline, role };

  // A public timeline grants read-only access to any signed-in user. It never
  // grants EDIT or MANAGE — those still require ownership or membership.
  if (capability === 'VIEW' && timeline.visibility !== 'PRIVATE') {
    return { resource: timeline, role: 'VIEWER' };
  }
  return null;
}

export async function requireTimeline(
  userId: string,
  timelineId: string,
  capability: Capability,
): Promise<Timeline> {
  const access = await resolveTimelineAccess(userId, timelineId, capability);
  if (!access) throw notFound();
  return access.resource;
}

/** Owner-or-manager, for role/visibility changes. */
export async function requireTimelineManage(userId: string, timelineId: string): Promise<Timeline> {
  return requireTimeline(userId, timelineId, 'MANAGE');
}

/**
 * Milestone access has three sources, in order of directness:
 *   1. owning the milestone,
 *   2. a milestone-scoped membership (grants rights on this milestone alone),
 *   3. a timeline-scoped membership on *any* timeline that links it.
 *
 * (3) is the user-chosen rule (DECISIONS #35): inviting a collaborator to a
 * timeline deliberately grants edit rights over the milestones on it. Because
 * a milestone can live on several timelines, that exposure is disclosed to the
 * owner at invite time via `getShareImpact` rather than silently restricted.
 */
export async function resolveMilestoneAccess(
  userId: string,
  milestoneId: string,
  capability: Capability,
): Promise<Access<Milestone> | null> {
  const milestone = await milestonesRepo.getMilestone(milestoneId);
  if (!milestone) return null;
  if (milestone.ownerId === userId) return { resource: milestone, role: 'OWNER' };

  const direct = await membersRepo.getMember('MILESTONE', milestoneId, userId);
  if (direct && roleAllows(direct.role, capability)) return { resource: milestone, role: direct.role };

  const refs = await linksRepo.listMilestoneRefs(milestoneId);
  const timelineIds = refs.map((r) => r.timelineId);
  if (timelineIds.length === 0) return null;

  // One BatchGet for memberships, one for the timelines themselves (needed to
  // catch the case where the caller *owns* a timeline that links this item).
  const [memberships, timelines] = await Promise.all([
    membersRepo.batchGetMemberships('TIMELINE', timelineIds, userId),
    timelinesRepo.batchGetTimelines(timelineIds),
  ]);

  for (const timelineId of timelineIds) {
    const timeline = timelines.get(timelineId);
    if (!timeline) continue;
    const role: Role | null =
      timeline.ownerId === userId ? 'OWNER' : (memberships.get(timelineId)?.role ?? null);
    if (role && roleAllows(role, capability)) return { resource: milestone, role };
    if (capability === 'VIEW' && timeline.visibility !== 'PRIVATE') {
      return { resource: milestone, role: 'VIEWER' };
    }
  }
  return null;
}

export async function requireMilestone(
  userId: string,
  milestoneId: string,
  capability: Capability,
): Promise<Milestone> {
  const access = await resolveMilestoneAccess(userId, milestoneId, capability);
  if (!access) throw notFound();
  return access.resource;
}

/** Stages have no per-stage membership — access flows from the timelines that link them. */
export async function requireStage(
  userId: string,
  stageId: string,
  capability: Capability,
): Promise<Stage> {
  const stage = await stagesRepo.getStage(stageId);
  if (!stage) throw notFound();
  if (stage.ownerId === userId) return stage;

  const refs = await linksRepo.listStageRefs(stageId);
  const timelineIds = refs.map((r) => r.timelineId);
  if (timelineIds.length === 0) throw notFound();

  const [memberships, timelines] = await Promise.all([
    membersRepo.batchGetMemberships('TIMELINE', timelineIds, userId),
    timelinesRepo.batchGetTimelines(timelineIds),
  ]);

  for (const timelineId of timelineIds) {
    const timeline = timelines.get(timelineId);
    if (!timeline) continue;
    const role: Role | null =
      timeline.ownerId === userId ? 'OWNER' : (memberships.get(timelineId)?.role ?? null);
    if (role && roleAllows(role, capability)) return stage;
    if (capability === 'VIEW' && timeline.visibility !== 'PRIVATE') return stage;
  }
  throw notFound();
}
