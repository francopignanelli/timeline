import { Hono } from 'hono';
import { setVisibilitySchema } from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const sharingRoutes = new Hono();

sharingRoutes.get('/timelines/:id/share', async (c) => {
  return c.json(await service.getShareSettings(getUserId(c), c.req.param('id')));
});

sharingRoutes.put('/timelines/:id/share', async (c) => {
  const body = setVisibilitySchema.parse(await c.req.json());
  return c.json(await service.setVisibility(getUserId(c), c.req.param('id'), body));
});

/** Revoke a leaked link without changing the timeline's identity. */
sharingRoutes.post('/timelines/:id/share/rotate', async (c) => {
  return c.json(await service.rotateShareToken(getUserId(c), c.req.param('id')));
});
