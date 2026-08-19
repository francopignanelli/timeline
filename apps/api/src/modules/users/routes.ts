import { Hono } from 'hono';
import { updateProfileSchema } from '@timeline/shared';
import { getStringClaim, getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const usersRoutes = new Hono();

usersRoutes.get('/me', async (c) => {
  const userId = getUserId(c);
  const profile = await service.getOrCreateProfile(userId, {
    username: getStringClaim(c, 'custom:username'),
    displayName: getStringClaim(c, 'name'),
    email: getStringClaim(c, 'email'),
  });
  return c.json(profile);
});

usersRoutes.put('/me', async (c) => {
  const userId = getUserId(c);
  const body = updateProfileSchema.parse(await c.req.json());
  const profile = await service.updateProfile(userId, body);
  return c.json(profile);
});
