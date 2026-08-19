import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTimeline, getTimeline, listTimelines } from '../../lib/mock/timeline-store';
import { countTimelinesReferencing, getTimelineContent } from '../../lib/mock/content-store';

export function useTimelines() {
  return useQuery({ queryKey: ['timelines'], queryFn: listTimelines });
}

export function useTimeline(id: string) {
  return useQuery({ queryKey: ['timelines', id], queryFn: () => getTimeline(id) });
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
    queryFn: () => countTimelinesReferencing(milestoneId ?? ''),
  });
}

export function useCreateTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTimeline,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timelines'] }),
  });
}
