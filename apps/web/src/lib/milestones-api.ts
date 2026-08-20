import type { CreateMilestoneInput, Milestone, UpdateMilestoneInput } from '@timeline/shared';
import { apiClient } from './api-client';

export function listMilestones(): Promise<Milestone[]> {
  return apiClient.get<Milestone[]>('/milestones');
}

export function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  return apiClient.post<Milestone>('/milestones', input);
}

export function updateMilestone(id: string, patch: UpdateMilestoneInput): Promise<Milestone> {
  return apiClient.patch<Milestone>(`/milestones/${id}`, patch);
}

export function deleteMilestone(id: string): Promise<void> {
  return apiClient.delete<void>(`/milestones/${id}`);
}

export function getMilestoneTimelineCount(id: string): Promise<number> {
  return apiClient.get<{ count: number }>(`/milestones/${id}/timeline-count`).then((r) => r.count);
}

/** Milestones shared with me through an accepted invitation. */
export function listSharedMilestones(): Promise<Milestone[]> {
  return apiClient.get<Milestone[]>('/milestones?scope=shared');
}
