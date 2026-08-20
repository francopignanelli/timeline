import type {
  CreateInvitationInput,
  GrantableRole,
  Invitation,
  Member,
  MemberScope,
} from '@timeline/shared';
import { apiClient } from './api-client';

/** Timeline and milestone collaboration share one API shape, two mounts. */
function base(scope: MemberScope): string {
  return scope === 'TIMELINE' ? 'timelines' : 'milestones';
}

export function listMembers(scope: MemberScope, resourceId: string): Promise<Member[]> {
  return apiClient.get<Member[]>(`/${base(scope)}/${resourceId}/members`);
}

export function listResourceInvitations(
  scope: MemberScope,
  resourceId: string,
): Promise<Invitation[]> {
  return apiClient.get<Invitation[]>(`/${base(scope)}/${resourceId}/invitations`);
}

export function inviteMember(
  scope: MemberScope,
  resourceId: string,
  input: CreateInvitationInput,
): Promise<Invitation> {
  return apiClient.post<Invitation>(`/${base(scope)}/${resourceId}/invitations`, input);
}

export function revokeInvitation(
  scope: MemberScope,
  resourceId: string,
  invitationId: string,
): Promise<void> {
  return apiClient.delete<void>(`/${base(scope)}/${resourceId}/invitations/${invitationId}`);
}

export function updateMemberRole(
  scope: MemberScope,
  resourceId: string,
  userId: string,
  role: GrantableRole,
): Promise<Member> {
  return apiClient.patch<Member>(`/${base(scope)}/${resourceId}/members/${userId}`, { role });
}

export function removeMember(
  scope: MemberScope,
  resourceId: string,
  userId: string,
): Promise<void> {
  return apiClient.delete<void>(`/${base(scope)}/${resourceId}/members/${userId}`);
}

// --- The invitee's side --------------------------------------------------

export function listMyInvitations(): Promise<Invitation[]> {
  return apiClient.get<Invitation[]>('/invitations');
}

export function acceptInvitation(invitationId: string): Promise<Member> {
  return apiClient.post<Member>(`/invitations/${invitationId}/accept`, {});
}

export function declineInvitation(invitationId: string): Promise<void> {
  return apiClient.post<void>(`/invitations/${invitationId}/decline`, {});
}

export interface UserSearchResult {
  username: string;
  displayName: string;
}

/** Backs the invite field and the `@mention` autocomplete. */
export function searchUsers(q: string): Promise<UserSearchResult[]> {
  return apiClient.get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`);
}
