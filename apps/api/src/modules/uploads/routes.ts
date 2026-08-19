import { Hono } from 'hono';
import { presignUploadSchema, viewUrlsSchema } from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const uploadsRoutes = new Hono();

uploadsRoutes.post('/uploads/presign', async (c) => {
  const body = presignUploadSchema.parse(await c.req.json());
  const result = await service.presignUpload(getUserId(c), body);
  return c.json(result, 201);
});

uploadsRoutes.post('/uploads/view-urls', async (c) => {
  const { keys } = viewUrlsSchema.parse(await c.req.json());
  const urls = await service.presignViewUrls(getUserId(c), keys, 'inline');
  return c.json({ urls });
});

uploadsRoutes.post('/uploads/download-urls', async (c) => {
  const { keys } = viewUrlsSchema.parse(await c.req.json());
  const urls = await service.presignViewUrls(getUserId(c), keys, 'attachment');
  return c.json({ urls });
});
