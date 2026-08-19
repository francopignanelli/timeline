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
import * as timelinesService from './service';
import * as milestonesService from '../milestones/service';
import * as stagesService from '../stages/service';

export interface TimelineContent {
  milestones: { ref: TimelineMilestoneRef; milestone: Milestone }[];
  stages: { ref: TimelineStageRef; stage: Stage }[];
}

/** AP5 + AP6: the full canvas payload for one Timeline. */
export async function getTimelineContent(ownerId: string, timelineId: string): Promise<TimelineContent> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);
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
  await timelinesService.getOwnTimeline(ownerId, timelineId);

  const milestone =
    'milestone' in input
      ? await milestonesService.createMilestone(ownerId, input.milestone)
      : await milestonesService.getOwnMilestone(ownerId, input.milestoneId);

  const { milestoneRefs } = await linksRepo.listTimelineLinks(timelineId);
  const ref = await linksRepo.linkMilestone(timelineId, milestone.id, milestoneRefs.length);
  return { ref, milestone };
}

export async function linkStageToTimeline(
  ownerId: string,
  timelineId: string,
  input: LinkStageInput,
): Promise<{ ref: TimelineStageRef; stage: Stage }> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);

  const stage =
    'stage' in input
      ? await stagesService.createStage(ownerId, input.stage)
      : await stagesService.getOwnStage(ownerId, input.stageId);

  const ref = await linksRepo.linkStage(timelineId, stage.id);
  return { ref, stage };
}

export async function unlinkMilestoneFromTimeline(
  ownerId: string,
  timelineId: string,
  milestoneId: string,
): Promise<void> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);
  await linksRepo.unlinkMilestone(timelineId, milestoneId);
}

export async function unlinkStageFromTimeline(
  ownerId: string,
  timelineId: string,
  stageId: string,
): Promise<void> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);
  await linksRepo.unlinkStage(timelineId, stageId);
}

export async function updateMilestoneLink(
  ownerId: string,
  timelineId: string,
  milestoneId: string,
  patch: UpdateMilestoneLinkInput,
): Promise<TimelineMilestoneRef> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);
  return linksRepo.updateMilestoneLink(timelineId, milestoneId, patch);
}

export async function updateStageLink(
  ownerId: string,
  timelineId: string,
  stageId: string,
  patch: UpdateStageLinkInput,
): Promise<TimelineStageRef> {
  await timelinesService.getOwnTimeline(ownerId, timelineId);
  return linksRepo.updateStageLink(timelineId, stageId, patch);
}
