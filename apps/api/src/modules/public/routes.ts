import { Hono } from 'hono';
import { publicMediaUrlsSchema, shareTokenSchema } from '@timeline/shared';
import * as sharing from '../sharing/service';
import * as uploads from '../uploads/service';
import * as setlists from '../setlists/service';
import { notFound } from '../../http-error';

/**
 * The only unauthenticated surface in the app. Mounted behind `/public/*`,
 * which is a **separate API Gateway route with no JWT authorizer** — the path
 * prefix is what makes "is this endpoint public?" answerable by inspection.
 *
 * Invariants for everything in this file:
 *   • never call `getUserId()` — there is no caller identity here;
 *   • re-check visibility on every request (the token is a lookup key, not a
 *     capability);
 *   • return the Public* DTOs only, never a raw item with `ownerId` on it.
 */
export const publicRoutes = new Hono();

function parseToken(raw: string): string {
  const parsed = shareTokenSchema.safeParse(raw);
  // A malformed token is indistinguishable from an unknown one.
  if (!parsed.success) throw notFound();
  return parsed.data;
}

publicRoutes.get('/public/timelines/:token', async (c) => {
  const timeline = await sharing.getPublicTimelineMeta(parseToken(c.req.param('token')));
  return c.json(timeline);
});

publicRoutes.get('/public/timelines/:token/content', async (c) => {
  const content = await sharing.getPublicContent(parseToken(c.req.param('token')));
  return c.json(content);
});

/**
 * Media on a public timeline, addressed by **block id**. The id is resolved
 * server-side against the media this timeline actually references, so a
 * caller can neither supply an arbitrary key nor learn one — the private
 * bucket cannot be turned into an open file server.
 */
/**
 * Setlist data for a shared timeline. Scoped to the setlists that timeline
 * actually references, so a share link can't turn the API into an open
 * setlist.fm proxy running on our key.
 */
publicRoutes.get('/public/timelines/:token/setlists/:setlistId', async (c) => {
  const token = parseToken(c.req.param('token'));
  const setlistId = c.req.param('setlistId');
  const allowed = await sharing.publicSetlistIds(token);
  if (!allowed.has(setlistId)) throw notFound();
  return c.json(await setlists.getSetlist(setlistId));
});

publicRoutes.post('/public/timelines/:token/media-urls', async (c) => {
  const token = parseToken(c.req.param('token'));
  const { blockIds } = publicMediaUrlsSchema.parse(await c.req.json());
  const allowed = await sharing.publicMediaKeysByBlockId(token);

  const wanted = blockIds.flatMap((id) => {
    const key = allowed.get(id);
    return key ? [[id, key] as const] : [];
  });
  const signed = await uploads.presignPublicViewUrls(wanted.map(([, key]) => key));

  // Re-key by block id so the client never sees an object key.
  const urls: Record<string, string> = {};
  for (const [id, key] of wanted) {
    const url = signed[key];
    if (url) urls[id] = url;
  }
  return c.json({ urls });
});
