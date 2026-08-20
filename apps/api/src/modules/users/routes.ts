import { Hono } from 'hono';
import { updateProfileSchema, userSearchSchema } from '@timeline/shared';
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

/**
 * Backs the `@mention` autocomplete. Deliberately narrow (DECISIONS #37):
 * authenticated only, minimum prefix length, hard result cap, and it returns
 * `username` + `displayName` **only** — never an email or a user id. Exact
 * username lookup first, then a bounded prefix scan.
 */
usersRoutes.get('/users/search', async (c) => {
  const parsed = userSearchSchema.safeParse({ q: (c.req.query('q') ?? '').toLowerCase() });
  if (!parsed.success) return c.json([]);
  const results = await service.searchUsers(parsed.data.q);
  return c.json(results);
});

usersRoutes.put('/me', async (c) => {
  const userId = getUserId(c);
  const body = updateProfileSchema.parse(await c.req.json());
  const profile = await service.updateProfile(userId, body);
  return c.json(profile);
});
