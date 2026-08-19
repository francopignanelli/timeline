import { Hono } from 'hono';
import { createMilestoneSchema, updateMilestoneSchema } from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const milestonesRoutes = new Hono();

milestonesRoutes.get('/milestones', async (c) => {
  const milestones = await service.listOwnMilestones(getUserId(c));
  return c.json(milestones);
});

milestonesRoutes.post('/milestones', async (c) => {
  const body = createMilestoneSchema.parse(await c.req.json());
  const milestone = await service.createMilestone(getUserId(c), body);
  return c.json(milestone, 201);
});

milestonesRoutes.get('/milestones/:id', async (c) => {
  const milestone = await service.getOwnMilestone(getUserId(c), c.req.param('id'));
  return c.json(milestone);
});

// Not in the original API.md endpoint list — added to back UI_SPEC.md's
// milestone modal footer ("Appears in N timelines", AP10).
milestonesRoutes.get('/milestones/:id/timeline-count', async (c) => {
  await service.getOwnMilestone(getUserId(c), c.req.param('id'));
  const count = await service.countTimelineRefs(c.req.param('id'));
  return c.json({ count });
});

milestonesRoutes.patch('/milestones/:id', async (c) => {
  const body = updateMilestoneSchema.parse(await c.req.json());
  const milestone = await service.updateOwnMilestone(getUserId(c), c.req.param('id'), body);
  return c.json(milestone);
});

milestonesRoutes.delete('/milestones/:id', async (c) => {
  await service.deleteOwnMilestone(getUserId(c), c.req.param('id'));
  return c.body(null, 204);
});
