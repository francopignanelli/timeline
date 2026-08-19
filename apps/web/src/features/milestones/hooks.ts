import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateMilestoneInput } from '@timeline/shared';
import { deleteMilestone, listMilestones, updateMilestone } from '../../lib/milestones-api';

export function useOwnMilestones() {
  return useQuery({ queryKey: ['milestones'], queryFn: listMilestones });
}

export function useUpdateMilestone(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateMilestoneInput) => updateMilestone(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['milestones'] });
      void queryClient.invalidateQueries({ queryKey: ['timelines'] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['milestones'] });
      void queryClient.invalidateQueries({ queryKey: ['timelines'] });
    },
  });
}
