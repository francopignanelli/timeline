import type { UpdateProfileInput, UserProfile } from '@timeline/shared';
import { apiClient } from './api-client';

/** GET /me creates the profile from Cognito attributes on first call (DECISIONS #20). */
export function getMe(): Promise<UserProfile> {
  return apiClient.get<UserProfile>('/me');
}

export function updateMe(input: UpdateProfileInput): Promise<UserProfile> {
  return apiClient.put<UserProfile>('/me', input);
}
