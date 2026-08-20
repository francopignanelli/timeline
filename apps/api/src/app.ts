import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { HttpError } from './http-error';
import { usersRoutes } from './modules/users/routes';
import { timelinesRoutes } from './modules/timelines/routes';
import { milestonesRoutes } from './modules/milestones/routes';
import { stagesRoutes } from './modules/stages/routes';
import { setlistsRoutes } from './modules/setlists/routes';
import { uploadsRoutes } from './modules/uploads/routes';
import { membersRoutes } from './modules/members/routes';
import { sharingRoutes } from './modules/sharing/routes';
import { publicRoutes } from './modules/public/routes';

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowHeaders: ['Authorization', 'Content-Type'],
  }),
);

// `/public/*` is served through a separate API Gateway route that carries no
// JWT authorizer; every other route below is reachable only with a valid token.
app.route('/', publicRoutes);

app.route('/', usersRoutes);
app.route('/', timelinesRoutes);
app.route('/', milestonesRoutes);
app.route('/', stagesRoutes);
app.route('/', setlistsRoutes);
app.route('/', uploadsRoutes);
app.route('/', membersRoutes);
app.route('/', sharingRoutes);

// Errors: { error: { code, message } } (API.md). Stack traces stay server-side (SECURITY.md).
app.onError((err, c) => {
  if (err instanceof HttpError) {
    // HttpError is only ever constructed by us with a valid HTTP status code.
    return c.json({ error: { code: err.code, message: err.message } }, err.status as ContentfulStatusCode);
  }
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }, 400);
  }
  console.error(err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, 500);
});
