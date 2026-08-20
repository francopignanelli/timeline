import { Hono } from 'hono';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';

export const setlistsRoutes = new Hono();

/**
 * Setlist data for any id. Requires a session: the content itself is public on
 * setlist.fm, but proxying it anonymously would let strangers spend our rate
 * limit. The public route (see modules/public) is scoped to a shared
 * timeline's own setlists instead.
 */
setlistsRoutes.get('/setlists/:id', async (c) => {
  getUserId(c);
  return c.json(await service.getSetlist(c.req.param('id')));
});
