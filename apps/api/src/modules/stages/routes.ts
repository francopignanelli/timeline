import { Hono } from 'hono';
import { createStageSchema, updateStageSchema } from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const stagesRoutes = new Hono();

/** `?scope=shared` mirrors the milestones endpoint — see the note there. */
stagesRoutes.get('/stages', async (c) => {
  const userId = getUserId(c);
  const stages =
    c.req.query('scope') === 'shared'
      ? await service.listSharedStages(userId)
      : await service.listOwnStages(userId);
  return c.json(stages);
});

stagesRoutes.post('/stages', async (c) => {
  const body = createStageSchema.parse(await c.req.json());
  const stage = await service.createStage(getUserId(c), body);
  return c.json(stage, 201);
});

stagesRoutes.get('/stages/:id', async (c) => {
  const stage = await service.getOwnStage(getUserId(c), c.req.param('id'));
  return c.json(stage);
});

// Not in the original API.md endpoint list — added so the client can warn
// about other referencing timelines before a destructive delete (UI_SPEC.md).
stagesRoutes.get('/stages/:id/timeline-count', async (c) => {
  await service.getOwnStage(getUserId(c), c.req.param('id'));
  const count = await service.countTimelineRefs(c.req.param('id'));
  return c.json({ count });
});

stagesRoutes.patch('/stages/:id', async (c) => {
  const body = updateStageSchema.parse(await c.req.json());
  const stage = await service.updateOwnStage(getUserId(c), c.req.param('id'), body);
  return c.json(stage);
});

stagesRoutes.delete('/stages/:id', async (c) => {
  await service.deleteOwnStage(getUserId(c), c.req.param('id'));
  return c.body(null, 204);
});
