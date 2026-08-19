import type { CreateStageInput, Stage, UpdateStageInput } from '@timeline/shared';
import { apiClient } from './api-client';

export function listStages(): Promise<Stage[]> {
  return apiClient.get<Stage[]>('/stages');
}

export function createStage(input: CreateStageInput): Promise<Stage> {
  return apiClient.post<Stage>('/stages', input);
}

export function updateStage(id: string, patch: UpdateStageInput): Promise<Stage> {
  return apiClient.patch<Stage>(`/stages/${id}`, patch);
}

export function deleteStage(id: string): Promise<void> {
  return apiClient.delete<void>(`/stages/${id}`);
}

export function getStageTimelineCount(id: string): Promise<number> {
  return apiClient.get<{ count: number }>(`/stages/${id}/timeline-count`).then((r) => r.count);
}
