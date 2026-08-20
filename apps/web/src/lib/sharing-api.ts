import type { SetVisibilityInput, ShareImpact, Visibility } from '@timeline/shared';
import { apiClient } from './api-client';

export interface ShareSettings {
  visibility: Visibility;
  shareToken?: string;
}

export function getShareSettings(timelineId: string): Promise<ShareSettings> {
  return apiClient.get<ShareSettings>(`/timelines/${timelineId}/share`);
}

export function setVisibility(
  timelineId: string,
  input: SetVisibilityInput,
): Promise<ShareSettings> {
  return apiClient.put<ShareSettings>(`/timelines/${timelineId}/share`, input);
}

/** Revokes the current link by replacing the token. */
export function rotateShareToken(timelineId: string): Promise<ShareSettings> {
  return apiClient.post<ShareSettings>(`/timelines/${timelineId}/share/rotate`, {});
}

/** What a timeline-scoped invite would expose — shown before inviting. */
export function getShareImpact(timelineId: string): Promise<ShareImpact> {
  return apiClient.get<ShareImpact>(`/timelines/${timelineId}/share-impact`);
}

/** The link handed to a visitor. Route is public; the token is the secret. */
export function publicUrlFor(shareToken: string): string {
  return `${window.location.origin}/p/${shareToken}`;
}
