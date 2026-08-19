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
import { apiClient } from './api-client';

export interface TimelineContent {
  milestones: { ref: TimelineMilestoneRef; milestone: Milestone }[];
  stages: { ref: TimelineStageRef; stage: Stage }[];
}

export function getTimelineContent(timelineId: string): Promise<TimelineContent> {
  return apiClient.get<TimelineContent>(`/timelines/${timelineId}/content`);
}

export function linkMilestone(
  timelineId: string,
  input: LinkMilestoneInput,
): Promise<{ ref: TimelineMilestoneRef; milestone: Milestone }> {
  return apiClient.post(`/timelines/${timelineId}/milestones`, input);
}

export function updateMilestoneLink(
  timelineId: string,
  milestoneId: string,
  patch: UpdateMilestoneLinkInput,
): Promise<TimelineMilestoneRef> {
  return apiClient.patch(`/timelines/${timelineId}/milestones/${milestoneId}`, patch);
}

export function unlinkMilestone(timelineId: string, milestoneId: string): Promise<void> {
  return apiClient.delete(`/timelines/${timelineId}/milestones/${milestoneId}`);
}

export function linkStage(
  timelineId: string,
  input: LinkStageInput,
): Promise<{ ref: TimelineStageRef; stage: Stage }> {
  return apiClient.post(`/timelines/${timelineId}/stages`, input);
}

export function updateStageLink(
  timelineId: string,
  stageId: string,
  patch: UpdateStageLinkInput,
): Promise<TimelineStageRef> {
  return apiClient.patch(`/timelines/${timelineId}/stages/${stageId}`, patch);
}

export function unlinkStage(timelineId: string, stageId: string): Promise<void> {
  return apiClient.delete(`/timelines/${timelineId}/stages/${stageId}`);
}
