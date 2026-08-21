import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LinkMilestoneInput,
  LinkStageInput,
  UpdateMilestoneLinkInput,
  UpdateStageLinkInput,
  UpdateTimelineInput,
} from '@timeline/shared';
import {
  createTimeline,
  deleteTimeline,
  getTimeline,
  listTimelines,
  updateTimeline,
} from '../../lib/timelines-api';
import { ApiError } from '../../lib/api-client';
import { getMilestoneTimelineCount } from '../../lib/milestones-api';
import {
  getTimelineContent,
  linkMilestone,
  linkStage,
  unlinkMilestone,
  unlinkStage,
  updateMilestoneLink,
  updateStageLink,
} from '../../lib/timeline-content-api';

export function useTimelines() {
  return useQuery({ queryKey: ['timelines'], queryFn: listTimelines });
}

export function useTimeline(id: string) {
  return useQuery({
    queryKey: ['timelines', id],
    queryFn: async () => {
      try {
        return await getTimeline(id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
}

export function useTimelineContent(id: string) {
  return useQuery({
    queryKey: ['timelines', id, 'content'],
    queryFn: () => getTimelineContent(id),
  });
}

export function useMilestoneReferenceCount(milestoneId: string | null) {
  return useQuery({
    enabled: milestoneId !== null,
    queryKey: ['milestones', milestoneId, 'refCount'],
    queryFn: () => getMilestoneTimelineCount(milestoneId ?? ''),
  });
}

export function useCreateTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTimeline,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines'] }),
  });
}

export function useUpdateTimeline(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTimelineInput) => updateTimeline(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timelines'] });
      void queryClient.invalidateQueries({ queryKey: ['timelines', id] });
    },
  });
}

export function useLinkMilestone(timelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkMilestoneInput) => linkMilestone(timelineId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

export function useUnlinkMilestone(timelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) => unlinkMilestone(timelineId, milestoneId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

/** Per-timeline presentation (color, highlight, order) lives on the link entity. */
export function useUpdateMilestoneLink(timelineId: string, milestoneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateMilestoneLinkInput) =>
      updateMilestoneLink(timelineId, milestoneId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

export function useUpdateStageLink(timelineId: string, stageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateStageLinkInput) => updateStageLink(timelineId, stageId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

export function useLinkStage(timelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkStageInput) => linkStage(timelineId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

export function useUnlinkStage(timelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => unlinkStage(timelineId, stageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines', timelineId, 'content'] }),
  });
}

export function useDeleteTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTimeline,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines'] }),
  });
}
