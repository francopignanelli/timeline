import { Hono } from 'hono';
import { createInvitationSchema, updateMemberRoleSchema } from '@timeline/shared';
import type { MemberScope } from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as access from '../access/service';
import * as service from './service';

export const membersRoutes = new Hono();

/** Timeline and milestone collaboration share one implementation, two mounts. */
function mountScope(scope: MemberScope, base: 'timelines' | 'milestones' | 'stages') {
  membersRoutes.get(`/${base}/:id/members`, async (c) => {
    const members = await service.listMembers(getUserId(c), scope, c.req.param('id'));
    return c.json(members);
  });

  membersRoutes.get(`/${base}/:id/invitations`, async (c) => {
    const invitations = await service.listPendingInvitations(getUserId(c), scope, c.req.param('id'));
    return c.json(invitations);
  });

  membersRoutes.post(`/${base}/:id/invitations`, async (c) => {
    const body = createInvitationSchema.parse(await c.req.json());
    const invitation = await service.inviteMember(getUserId(c), scope, c.req.param('id'), body);
    return c.json(invitation, 201);
  });

  membersRoutes.delete(`/${base}/:id/invitations/:invitationId`, async (c) => {
    await service.revokeInvitation(
      getUserId(c),
      scope,
      c.req.param('id'),
      c.req.param('invitationId'),
    );
    return c.body(null, 204);
  });

  membersRoutes.patch(`/${base}/:id/members/:userId`, async (c) => {
    const body = updateMemberRoleSchema.parse(await c.req.json());
    const member = await service.updateMemberRole(
      getUserId(c),
      scope,
      c.req.param('id'),
      c.req.param('userId'),
      body.role,
    );
    return c.json(member);
  });

  membersRoutes.delete(`/${base}/:id/members/:userId`, async (c) => {
    await service.removeMember(getUserId(c), scope, c.req.param('id'), c.req.param('userId'));
    return c.body(null, 204);
  });
}

mountScope('TIMELINE', 'timelines');
mountScope('MILESTONE', 'milestones');
mountScope('STAGE', 'stages');

/** Disclosure shown before a timeline-scoped invite is sent (DECISIONS #35). */
membersRoutes.get('/timelines/:id/share-impact', async (c) => {
  const timeline = await access.requireTimeline(getUserId(c), c.req.param('id'), 'MANAGE');
  return c.json(await service.getShareImpact(timeline));
});

// --- The invitee's side --------------------------------------------------

membersRoutes.get('/invitations', async (c) => {
  return c.json(await service.listMyInvitations(getUserId(c)));
});

membersRoutes.post('/invitations/:id/accept', async (c) => {
  const member = await service.acceptInvitation(getUserId(c), c.req.param('id'));
  return c.json(member, 201);
});

membersRoutes.post('/invitations/:id/decline', async (c) => {
  await service.declineInvitation(getUserId(c), c.req.param('id'));
  return c.body(null, 204);
});
