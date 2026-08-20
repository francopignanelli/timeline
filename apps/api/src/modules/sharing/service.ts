import { randomBytes } from 'node:crypto';
import type {
  PublicMilestone,
  PublicStage,
  PublicTimeline,
  SetVisibilityInput,
  Timeline,
  TimelineMilestoneRef,
  TimelineStageRef,
} from '@timeline/shared';
import * as timelinesRepo from '../../repositories/timelines-repo';
import * as linksRepo from '../../repositories/links-repo';
import * as access from '../access/service';
import { notFound } from '../../http-error';

/** 32 URL-safe chars from 24 random bytes — not derived from the timeline id. */
function mintShareToken(): string {
  return randomBytes(24).toString('base64url');
}

export interface ShareSettings {
  visibility: Timeline['visibility'];
  shareToken?: string;
}

/**
 * Visibility changes run through here rather than the general PATCH so the
 * token lifecycle stays in one place: leaving PRIVATE mints a token, returning
 * to PRIVATE destroys it, and the old claim item is always removed so a leaked
 * link stops resolving immediately (DECISIONS #36).
 */
export async function setVisibility(
  userId: string,
  timelineId: string,
  input: SetVisibilityInput,
): Promise<ShareSettings> {
  const timeline = await access.requireTimeline(userId, timelineId, 'MANAGE');

  if (input.visibility === 'PRIVATE') {
    if (timeline.shareToken) await timelinesRepo.deleteShareToken(timeline.shareToken);
    await timelinesRepo.setTimelineShare(timelineId, 'PRIVATE', null);
    return { visibility: 'PRIVATE' };
  }

  const shareToken = timeline.shareToken ?? mintShareToken();
  if (!timeline.shareToken) await timelinesRepo.putShareToken(shareToken, timelineId);
  await timelinesRepo.setTimelineShare(timelineId, input.visibility, shareToken);
  return { visibility: input.visibility, shareToken };
}

/** Revoking a leaked link: the old claim dies, a fresh token replaces it. */
export async function rotateShareToken(userId: string, timelineId: string): Promise<ShareSettings> {
  const timeline = await access.requireTimeline(userId, timelineId, 'MANAGE');
  if (timeline.visibility === 'PRIVATE') throw notFound();

  if (timeline.shareToken) await timelinesRepo.deleteShareToken(timeline.shareToken);
  const shareToken = mintShareToken();
  await timelinesRepo.putShareToken(shareToken, timelineId);
  await timelinesRepo.setTimelineShare(timelineId, timeline.visibility, shareToken);
  return { visibility: timeline.visibility, shareToken };
}

export async function getShareSettings(userId: string, timelineId: string): Promise<ShareSettings> {
  const timeline = await access.requireTimeline(userId, timelineId, 'MANAGE');
  return timeline.shareToken
    ? { visibility: timeline.visibility, shareToken: timeline.shareToken }
    : { visibility: timeline.visibility };
}

// --- Anonymous read path -------------------------------------------------

function toPublicTimeline(timeline: Timeline): PublicTimeline {
  const { ownerId: _o, shareToken: _s, ...rest } = timeline;
  return rest;
}

/**
 * Resolves a share token to a timeline, re-checking visibility on **every**
 * request — the token is a lookup key, never a capability. A token for a
 * timeline since made private stops working immediately.
 */
export async function getPublicTimeline(token: string): Promise<Timeline> {
  const timelineId = await timelinesRepo.getTimelineIdByShareToken(token);
  if (!timelineId) throw notFound();
  const timeline = await timelinesRepo.getTimeline(timelineId);
  if (!timeline || timeline.visibility === 'PRIVATE') throw notFound();
  return timeline;
}

export async function getPublicTimelineMeta(token: string): Promise<PublicTimeline> {
  return toPublicTimeline(await getPublicTimeline(token));
}

export interface PublicContent {
  milestones: { ref: TimelineMilestoneRef; milestone: PublicMilestone }[];
  stages: { ref: TimelineStageRef; stage: PublicStage }[];
}

/** Same shape as the authenticated canvas payload, with every identifier stripped. */
export async function getPublicContent(token: string): Promise<PublicContent> {
  const timeline = await getPublicTimeline(token);
  const { milestoneRefs, stageRefs } = await linksRepo.listTimelineLinks(timeline.id);
  const [milestoneById, stageById] = await Promise.all([
    linksRepo.batchGetMilestones(milestoneRefs.map((r) => r.milestoneId)),
    linksRepo.batchGetStages(stageRefs.map((r) => r.stageId)),
  ]);

  return {
    milestones: milestoneRefs.flatMap((ref) => {
      const milestone = milestoneById.get(ref.milestoneId);
      if (!milestone) return [];
      const { ownerId: _o, mentions, blocks, ...rest } = milestone;
      return [
        {
          ref,
          milestone: {
            ...rest,
            // The key path embeds the owner's id, so it never goes out.
            blocks: blocks.map((block) =>
              's3Key' in block ? (({ s3Key: _k, ...b }) => b)(block) : block,
            ),
            // Usernames survive so mentions still render; user ids do not.
            ...(mentions?.length ? { mentions: mentions.map((m) => ({ username: m.username })) } : {}),
          },
        },
      ];
    }),
    stages: stageRefs.flatMap((ref) => {
      const stage = stageById.get(ref.stageId);
      if (!stage) return [];
      const { ownerId: _o, ...rest } = stage;
      return [{ ref, stage: rest }];
    }),
  };
}

/**
 * blockId → object key, for exactly the media this shared timeline references.
 * The public media endpoint can only presign keys reachable through this map,
 * so a caller-supplied key is never signed and the private bucket stays
 * private (SECURITY.md).
 */
export async function publicMediaKeysByBlockId(token: string): Promise<Map<string, string>> {
  const timeline = await getPublicTimeline(token);
  const { milestoneRefs } = await linksRepo.listTimelineLinks(timeline.id);
  const milestoneById = await linksRepo.batchGetMilestones(milestoneRefs.map((r) => r.milestoneId));

  const map = new Map<string, string>();
  for (const ref of milestoneRefs) {
    const milestone = milestoneById.get(ref.milestoneId);
    if (!milestone) continue;
    for (const block of milestone.blocks) {
      if ('s3Key' in block) map.set(block.id, block.s3Key);
    }
  }
  return map;
}
