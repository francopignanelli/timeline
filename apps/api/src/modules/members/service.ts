import { ulid } from 'ulid';
import { LIMITS } from '@timeline/shared';
import type {
  CreateInvitationInput,
  Invitation,
  Member,
  MemberScope,
  ShareImpact,
  Timeline,
} from '@timeline/shared';
import * as membersRepo from '../../repositories/members-repo';
import * as usersRepo from '../../repositories/users-repo';
import * as linksRepo from '../../repositories/links-repo';
import * as timelinesRepo from '../../repositories/timelines-repo';
import * as milestonesRepo from '../../repositories/milestones-repo';
import * as stagesRepo from '../../repositories/stages-repo';
import * as access from '../access/service';
import { HttpError, conflict, notFound } from '../../http-error';

/** MANAGE on the resource — only an owner can hand out or revoke access. */
async function requireManage(userId: string, scope: MemberScope, resourceId: string): Promise<void> {
  if (scope === 'TIMELINE') await access.requireTimeline(userId, resourceId, 'MANAGE');
  else if (scope === 'MILESTONE') await access.requireMilestone(userId, resourceId, 'MANAGE');
  else await access.requireStage(userId, resourceId, 'MANAGE');
}

/** VIEW on the resource — any member may see who else has access. */
async function requireView(userId: string, scope: MemberScope, resourceId: string): Promise<void> {
  if (scope === 'TIMELINE') await access.requireTimeline(userId, resourceId, 'VIEW');
  else if (scope === 'MILESTONE') await access.requireMilestone(userId, resourceId, 'VIEW');
  else await access.requireStage(userId, resourceId, 'VIEW');
}

/** Denormalized onto the invitation so the invitee can see what they're being invited to. */
async function resourceTitle(scope: MemberScope, resourceId: string): Promise<string> {
  // Static imports: repositories are leaves and import no services, so there
  // is no cycle to dodge here. A dynamic import() in a bundled Lambda is a
  // needless runtime risk on a path that must not fail.
  if (scope === 'TIMELINE') return (await timelinesRepo.getTimeline(resourceId))?.title ?? '';
  if (scope === 'MILESTONE') return (await milestonesRepo.getMilestone(resourceId))?.title ?? '';
  return (await stagesRepo.getStage(resourceId))?.title ?? '';
}

export async function listMembers(
  userId: string,
  scope: MemberScope,
  resourceId: string,
): Promise<Member[]> {
  // Any viewer may see who else has access; only managers may change it.
  await requireView(userId, scope, resourceId);
  return membersRepo.listMembers(scope, resourceId);
}

export async function listPendingInvitations(
  userId: string,
  scope: MemberScope,
  resourceId: string,
): Promise<Invitation[]> {
  await requireManage(userId, scope, resourceId);
  const all = await membersRepo.listInvitationsForResource(scope, resourceId);
  return all.filter((i) => i.status === 'PENDING');
}

/**
 * Invitations name a **username**, resolved here through AP2 — a client can
 * never designate a subject by userId (SECURITY.md). Only grantable roles are
 * accepted by the schema, so OWNER cannot be handed out this way.
 */
export async function inviteMember(
  inviterId: string,
  scope: MemberScope,
  resourceId: string,
  input: CreateInvitationInput,
): Promise<Invitation> {
  await requireManage(inviterId, scope, resourceId);

  const invitee = await usersRepo.getUserByUsername(input.username);
  if (!invitee) throw notFound();
  if (invitee.id === inviterId) {
    throw new HttpError(400, 'CANNOT_INVITE_SELF', 'You already have access');
  }

  const existing = await membersRepo.getMember(scope, resourceId, invitee.id);
  if (existing) throw conflict('That user already has access');

  const members = await membersRepo.listMembers(scope, resourceId);
  if (members.length >= LIMITS.MEMBERS_PER_RESOURCE_MAX) {
    throw new HttpError(400, 'MEMBER_LIMIT_REACHED', 'Member limit reached');
  }

  const pending = await membersRepo.listInvitationsForResource(scope, resourceId);
  if (pending.some((i) => i.inviteeId === invitee.id && i.status === 'PENDING')) {
    throw conflict('That user already has a pending invitation');
  }

  const inviter = await usersRepo.getUserProfile(inviterId);
  const now = new Date();
  const expires = new Date(now.getTime() + LIMITS.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  return membersRepo.createInvitation({
    id: ulid(),
    scope,
    resourceId,
    resourceTitle: await resourceTitle(scope, resourceId),
    inviteeId: invitee.id,
    inviteeUsername: invitee.username,
    inviterId,
    inviterName: inviter?.displayName ?? inviter?.username ?? '',
    role: input.role,
    status: 'PENDING',
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
}

export function listMyInvitations(userId: string): Promise<Invitation[]> {
  return membersRepo
    .listInvitationsForUser(userId)
    .then((all) =>
      all.filter((i) => i.status === 'PENDING' && new Date(i.expiresAt) > new Date()),
    );
}

async function findMyInvitation(userId: string, invitationId: string): Promise<Invitation> {
  const mine = await membersRepo.listInvitationsForUser(userId);
  const invitation = mine.find((i) => i.id === invitationId);
  // Addressed to someone else, or nonexistent — indistinguishable by design.
  if (!invitation || invitation.inviteeId !== userId) throw notFound();
  return invitation;
}

export async function acceptInvitation(userId: string, invitationId: string): Promise<Member> {
  const invitation = await findMyInvitation(userId, invitationId);
  if (invitation.status !== 'PENDING') throw conflict('Invitation is no longer pending');
  if (new Date(invitation.expiresAt) <= new Date()) throw conflict('Invitation has expired');

  const profile = await usersRepo.getUserProfile(userId);
  if (!profile) throw notFound();

  const member: Member = {
    scope: invitation.scope,
    resourceId: invitation.resourceId,
    userId,
    username: profile.username,
    displayName: profile.displayName,
    role: invitation.role,
    addedAt: new Date().toISOString(),
    addedBy: invitation.inviterId,
  };
  await membersRepo.acceptInvitation(invitation, member);
  return member;
}

export async function declineInvitation(userId: string, invitationId: string): Promise<void> {
  const invitation = await findMyInvitation(userId, invitationId);
  if (invitation.status !== 'PENDING') throw conflict('Invitation is no longer pending');
  await membersRepo.setInvitationStatus(invitation, 'DECLINED');
}

export async function revokeInvitation(
  userId: string,
  scope: MemberScope,
  resourceId: string,
  invitationId: string,
): Promise<void> {
  await requireManage(userId, scope, resourceId);
  await membersRepo.deleteInvitation(scope, resourceId, invitationId);
}

export async function updateMemberRole(
  actorId: string,
  scope: MemberScope,
  resourceId: string,
  targetUserId: string,
  role: Member['role'],
): Promise<Member> {
  await requireManage(actorId, scope, resourceId);
  // `role` comes from updateMemberRoleSchema, which admits only grantable
  // roles — so this path cannot escalate anyone to OWNER.
  const existing = await membersRepo.getMember(scope, resourceId, targetUserId);
  if (!existing) throw notFound();
  return membersRepo.updateMemberRole(scope, resourceId, targetUserId, role);
}

/** A manager may remove anyone; a member may always remove themselves (leave). */
export async function removeMember(
  actorId: string,
  scope: MemberScope,
  resourceId: string,
  targetUserId: string,
): Promise<void> {
  if (actorId !== targetUserId) await requireManage(actorId, scope, resourceId);
  else if (!(await membersRepo.getMember(scope, resourceId, targetUserId))) throw notFound();
  await membersRepo.deleteMember(scope, resourceId, targetUserId);
}

/**
 * What a timeline-scoped invite is about to expose. Surfaced *before* the
 * invite is sent so the cross-timeline reach of the grant is disclosed rather
 * than discovered (DECISIONS #35).
 */
export async function getShareImpact(timeline: Timeline): Promise<ShareImpact> {
  const { milestoneRefs, stageRefs } = await linksRepo.listTimelineLinks(timeline.id);

  const sharedFlags = await Promise.all(
    milestoneRefs.map(async (ref) => {
      const refs = await linksRepo.listMilestoneRefs(ref.milestoneId);
      return refs.length > 1;
    }),
  );

  return {
    milestoneCount: milestoneRefs.length,
    stageCount: stageRefs.length,
    sharedMilestoneCount: sharedFlags.filter(Boolean).length,
  };
}
