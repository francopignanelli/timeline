import type {
  LinkMilestoneInput,
  LinkStageInput,
  Milestone,
  Stage,
  TimelineMilestoneRef,
  TimelineStageRef,
  UpdateMilestoneLinkInput,
  UpdateStageLinkInput,
} from '@timeline/shared';
import * as linksRepo from '../../repositories/links-repo';
import * as access from '../access/service';
import * as milestonesService from '../milestones/service';
import * as stagesService from '../stages/service';
import * as timelinesService from './service';
import { expandedBounds, stageEffectiveEnd } from './boundary-expansion';

export interface TimelineContent {
  milestones: { ref: TimelineMilestoneRef; milestone: Milestone }[];
  stages: { ref: TimelineStageRef; stage: Stage }[];
}

/** AP5 + AP6: the full canvas payload for one Timeline. Readable by any viewer. */
export async function getTimelineContent(userId: string, timelineId: string): Promise<TimelineContent> {
  await access.requireTimeline(userId, timelineId, 'VIEW');
  const { milestoneRefs, stageRefs } = await linksRepo.listTimelineLinks(timelineId);
  const [milestoneById, stageById] = await Promise.all([
    linksRepo.batchGetMilestones(milestoneRefs.map((r) => r.milestoneId)),
    linksRepo.batchGetStages(stageRefs.map((r) => r.stageId)),
  ]);

  return {
    milestones: milestoneRefs.flatMap((ref) => {
      const milestone = milestoneById.get(ref.milestoneId);
      return milestone ? [{ ref, milestone }] : [];
    }),
    stages: stageRefs.flatMap((ref) => {
      const stage = stageById.get(ref.stageId);
      return stage ? [{ ref, stage }] : [];
    }),
  };
}

export async function linkMilestoneToTimeline(
  ownerId: string,
  timelineId: string,
  input: LinkMilestoneInput,
): Promise<{ ref: TimelineMilestoneRef; milestone: Milestone }> {
  const timeline = await access.requireTimeline(ownerId, timelineId, 'EDIT');

  const milestone =
    'milestone' in input
      ? await milestonesService.createMilestone(ownerId, input.milestone)
      : await milestonesService.getOwnMilestone(ownerId, input.milestoneId);

  // A milestone dated outside the timeline's own range must not vanish off
  // the canvas the instant it's attached — the canvas only ever renders
  // between the timeline's start and today (product rule, see canvas-items.ts).
  const patch = expandedBounds(timeline, milestone.date);
  if (patch) await timelinesService.updateOwnTimeline(ownerId, timelineId, patch);

  const { milestoneRefs } = await linksRepo.listTimelineLinks(timelineId);
  const ref = await linksRepo.linkMilestone(timelineId, milestone.id, milestoneRefs.length);
  return { ref, milestone };
}

export async function linkStageToTimeline(
  ownerId: string,
  timelineId: string,
  input: LinkStageInput,
): Promise<{ ref: TimelineStageRef; stage: Stage }> {
  const timeline = await access.requireTimeline(ownerId, timelineId, 'EDIT');

  const stage =
    'stage' in input
      ? await stagesService.createStage(ownerId, input.stage)
      : await stagesService.getOwnStage(ownerId, input.stageId);

  // Same boundary-widening as a milestone, but over the stage's whole span
  // rather than a single point — an ongoing stage's open end still only
  // pulls the timeline's end up to today, never past it (stageEffectiveEnd).
  const patch = expandedBounds(timeline, stage.start, stageEffectiveEnd(stage));
  if (patch) await timelinesService.updateOwnTimeline(ownerId, timelineId, patch);

  const ref = await linksRepo.linkStage(timelineId, stage.id);
  return { ref, stage };
}

export async function unlinkMilestoneFromTimeline(
  ownerId: string,
  timelineId: string,
  milestoneId: string,
): Promise<void> {
  await access.requireTimeline(ownerId, timelineId, 'EDIT');
  await linksRepo.unlinkMilestone(timelineId, milestoneId);
}

export async function unlinkStageFromTimeline(
  ownerId: string,
  timelineId: string,
  stageId: string,
): Promise<void> {
  await access.requireTimeline(ownerId, timelineId, 'EDIT');
  await linksRepo.unlinkStage(timelineId, stageId);
}

export async function updateMilestoneLink(
  ownerId: string,
  timelineId: string,
  milestoneId: string,
  patch: UpdateMilestoneLinkInput,
): Promise<TimelineMilestoneRef> {
  await access.requireTimeline(ownerId, timelineId, 'EDIT');
  return linksRepo.updateMilestoneLink(timelineId, milestoneId, patch);
}

export async function updateStageLink(
  ownerId: string,
  timelineId: string,
  stageId: string,
  patch: UpdateStageLinkInput,
): Promise<TimelineStageRef> {
  await access.requireTimeline(ownerId, timelineId, 'EDIT');
  return linksRepo.updateStageLink(timelineId, stageId, patch);
}
