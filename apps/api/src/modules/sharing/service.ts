import { randomBytes } from 'node:crypto';
import type {
  ContentBlock,
  PublicContentBlock,
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

/**
 * Drops `s3Key` from every media block. The key path embeds the owner's user
 * id, so it must never cross the public boundary; anonymous viewers address
 * media by block id instead (SECURITY.md).
 */
function stripBlockKeys(blocks: ContentBlock[]): PublicContentBlock[] {
  return blocks.map((block) => ('s3Key' in block ? (({ s3Key: _k, ...rest }) => rest)(block) : block));
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
            blocks: stripBlockKeys(blocks),
            // Usernames survive so mentions still render; user ids do not.
            ...(mentions?.length ? { mentions: mentions.map((m) => ({ username: m.username })) } : {}),
          },
        },
      ];
    }),
    stages: stageRefs.flatMap((ref) => {
      const stage = stageById.get(ref.stageId);
      if (!stage) return [];
      const { ownerId: _o, blocks, ...rest } = stage;
      return [{ ref, stage: { ...rest, ...(blocks ? { blocks: stripBlockKeys(blocks) } : {}) } }];
    }),
  };
}

/**
 * Every content block reachable through a share link. Milestones *and* Stages
 * both carry blocks, so both are walked — an allowlist built from milestones
 * alone would silently 404 media and setlists that live on a Stage.
 */
async function publicBlocks(token: string): Promise<ContentBlock[]> {
  const timeline = await getPublicTimeline(token);
  const { milestoneRefs, stageRefs } = await linksRepo.listTimelineLinks(timeline.id);
  const [milestoneById, stageById] = await Promise.all([
    linksRepo.batchGetMilestones(milestoneRefs.map((r) => r.milestoneId)),
    linksRepo.batchGetStages(stageRefs.map((r) => r.stageId)),
  ]);

  return [
    ...[...milestoneById.values()].flatMap((m) => m.blocks),
    ...[...stageById.values()].flatMap((st) => st.blocks ?? []),
  ];
}

/**
 * Setlist ids this shared timeline actually references. The public setlist
 * route serves only these, so a share link can't be used to proxy arbitrary
 * setlist.fm lookups through our API key.
 */
export async function publicSetlistIds(token: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const block of await publicBlocks(token)) {
    if (block.type === 'SETLIST') ids.add(block.setlistId);
  }
  return ids;
}

/**
 * blockId → object key, for exactly the media this shared timeline references.
 * The public media endpoint can only presign keys reachable through this map,
 * so a caller-supplied key is never signed and the private bucket stays
 * private (SECURITY.md).
 */
export async function publicMediaKeysByBlockId(token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const block of await publicBlocks(token)) {
    if ('s3Key' in block) map.set(block.id, block.s3Key);
  }
  return map;
}

