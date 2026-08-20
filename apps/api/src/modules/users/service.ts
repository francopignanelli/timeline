import { LIMITS, usernameSchema } from '@timeline/shared';
import type { UpdateProfileInput, UserProfile } from '@timeline/shared';
import * as repo from '../../repositories/users-repo';

interface CognitoAttrs {
  username?: string;
  displayName?: string;
  email?: string;
}

function fallbackUsername(attrs: CognitoAttrs, userId: string): string {
  const base = (attrs.email?.split('@')[0] ?? userId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, LIMITS.USERNAME_MAX);
  return usernameSchema.safeParse(base).success ? base : `user${userId.replace(/[^a-z0-9]/g, '').slice(0, 11)}`;
}

/** GET /me creates the profile on first call (API.md) — Cognito attributes seed it (DECISIONS #20). */
export async function getOrCreateProfile(userId: string, attrs: CognitoAttrs): Promise<UserProfile> {
  const existing = await repo.getUserProfile(userId);
  if (existing) return existing;

  const username = usernameSchema.safeParse(attrs.username).success
    ? (attrs.username as string)
    : fallbackUsername(attrs, userId);

  return repo.createUserProfile({
    id: userId,
    username,
    displayName: attrs.displayName?.trim() || attrs.email || username,
    locale: 'en',
    createdAt: new Date().toISOString(),
  });
}

export function updateProfile(userId: string, patch: UpdateProfileInput): Promise<UserProfile> {
  return repo.updateUserProfile(userId, patch);
}

/** Public shape of a user in search results — no email, no id (DECISIONS #37). */
export interface UserSearchResult {
  username: string;
  displayName: string;
}

export async function searchUsers(prefix: string): Promise<UserSearchResult[]> {
  const matches = await repo.searchUsernamesByPrefix(prefix, LIMITS.USER_SEARCH_LIMIT);
  return matches.map((u) => ({ username: u.username, displayName: u.displayName }));
}
