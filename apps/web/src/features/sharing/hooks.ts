import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateInvitationInput, GrantableRole, MemberScope } from '@timeline/shared';
import {
  getShareImpact,
  getShareSettings,
  rotateShareToken,
  setVisibility,
} from '../../lib/sharing-api';
import {
  acceptInvitation,
  declineInvitation,
  inviteMember,
  listMembers,
  listMyInvitations,
  listResourceInvitations,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from '../../lib/members-api';

export function useShareSettings(timelineId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['share', timelineId],
    queryFn: () => getShareSettings(timelineId),
  });
}

/** Only fetched when a timeline-scoped invite is being composed. */
export function useShareImpact(timelineId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['share', timelineId, 'impact'],
    queryFn: () => getShareImpact(timelineId),
  });
}

export function useSetVisibility(timelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC') =>
      setVisibility(timelineId, { visibility }),
    onSuccess: (data) => {
      qc.setQueryData(['share', timelineId], data);
      void qc.invalidateQueries({ queryKey: ['timelines', timelineId] });
    },
  });
}

export function useRotateShareToken(timelineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rotateShareToken(timelineId),
    onSuccess: (data) => qc.setQueryData(['share', timelineId], data),
  });
}

export function useMembers(scope: MemberScope, resourceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['members', scope, resourceId],
    queryFn: () => listMembers(scope, resourceId),
  });
}

export function useResourceInvitations(scope: MemberScope, resourceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ['invitations', scope, resourceId],
    queryFn: () => listResourceInvitations(scope, resourceId),
  });
}

function useCollaborationMutation<TArgs>(
  scope: MemberScope,
  resourceId: string,
  fn: (args: TArgs) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['members', scope, resourceId] });
      void qc.invalidateQueries({ queryKey: ['invitations', scope, resourceId] });
    },
  });
}

export function useInviteMember(scope: MemberScope, resourceId: string) {
  return useCollaborationMutation(scope, resourceId, (input: CreateInvitationInput) =>
    inviteMember(scope, resourceId, input),
  );
}

export function useRevokeInvitation(scope: MemberScope, resourceId: string) {
  return useCollaborationMutation(scope, resourceId, (invitationId: string) =>
    revokeInvitation(scope, resourceId, invitationId),
  );
}

export function useUpdateMemberRole(scope: MemberScope, resourceId: string) {
  return useCollaborationMutation(scope, resourceId, (args: { userId: string; role: GrantableRole }) =>
    updateMemberRole(scope, resourceId, args.userId, args.role),
  );
}

export function useRemoveMember(scope: MemberScope, resourceId: string) {
  return useCollaborationMutation(scope, resourceId, (userId: string) =>
    removeMember(scope, resourceId, userId),
  );
}

/** Pending invitations addressed to the signed-in user. */
/** How often the notifications bell re-checks while the tab is in front. */
const NOTIFICATIONS_POLL_MS = 30_000;

/**
 * Pending invitations, kept fresh without a page reload.
 *
 * Polling rather than push: a WebSocket API would be true real-time but adds a
 * stateful connection surface (connection table, connect/disconnect routes,
 * reconnection handling) for a payload that changes a few times a day. At one
 * request per 30s per *visible* tab this stays comfortably inside the free
 * tier (COSTS.md).
 *
 * Two deliberate scopings:
 *   • `refetchIntervalInBackground` stays false (the default), so a tab left
 *     open in another window costs nothing.
 *   • `refetchOnWindowFocus` is re-enabled *here only*. It's off globally
 *     because refetches were clobbering in-progress edit forms (DECISIONS
 *     #38) — this query feeds no form, so it's safe and makes the common
 *     "switch back to the tab" case feel instant.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: ['invitations', 'mine'],
    queryFn: listMyInvitations,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useRespondToInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) await acceptInvitation(id);
      else await declineInvitation(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invitations', 'mine'] });
      // Accepting adds a timeline to the caller's dashboard.
      void qc.invalidateQueries({ queryKey: ['timelines'] });
    },
  });
}
