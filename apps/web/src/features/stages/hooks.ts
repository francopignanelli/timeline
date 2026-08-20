import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateStageInput } from '@timeline/shared';
import {
  deleteStage,
  getStageTimelineCount,
  listSharedStages,
  listStages,
  updateStage,
} from '../../lib/stages-api';

export function useOwnStages() {
  return useQuery({ queryKey: ['stages'], queryFn: listStages });
}

export function useStageReferenceCount(stageId: string | null) {
  return useQuery({
    enabled: stageId !== null,
    queryKey: ['stages', stageId, 'refCount'],
    queryFn: () => getStageTimelineCount(stageId ?? ''),
  });
}

export function useUpdateStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateStageInput) => updateStage(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stages'] });
      void queryClient.invalidateQueries({ queryKey: ['timelines'] });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteStage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stages'] });
      void queryClient.invalidateQueries({ queryKey: ['timelines'] });
    },
  });
}

/** Stages shared with me via an accepted invitation (kept separate from mine). */
export function useSharedStages() {
  return useQuery({ queryKey: ['stages', 'shared'], queryFn: listSharedStages });
}
