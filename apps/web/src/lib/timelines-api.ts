import type { CreateTimelineInput, Timeline, UpdateTimelineInput } from '@timeline/shared';
import { apiClient } from './api-client';

/** Real API client for Timelines (Phase 5), matching docs/API.md. */

export function listTimelines(): Promise<Timeline[]> {
  return apiClient.get<Timeline[]>('/timelines');
}

export function getTimeline(id: string): Promise<Timeline> {
  return apiClient.get<Timeline>(`/timelines/${id}`);
}

export function createTimeline(input: CreateTimelineInput): Promise<Timeline> {
  return apiClient.post<Timeline>('/timelines', input);
}

export function updateTimeline(id: string, patch: UpdateTimelineInput): Promise<Timeline> {
  return apiClient.patch<Timeline>(`/timelines/${id}`, patch);
}

export function deleteTimeline(id: string): Promise<void> {
  return apiClient.delete<void>(`/timelines/${id}`);
}
