import { Hono } from 'hono';
import {
  createTimelineSchema,
  linkMilestoneSchema,
  linkStageSchema,
  updateMilestoneLinkSchema,
  updateStageLinkSchema,
  updateTimelineSchema,
} from '@timeline/shared';
import { getUserId } from '../../middleware/auth-context';
import * as service from './service';
import * as contentService from './content-service';

export const timelinesRoutes = new Hono();

timelinesRoutes.get('/timelines', async (c) => {
  const timelines = await service.listOwnTimelines(getUserId(c));
  return c.json(timelines);
});

timelinesRoutes.post('/timelines', async (c) => {
  const body = createTimelineSchema.parse(await c.req.json());
  const timeline = await service.createTimeline(getUserId(c), body);
  return c.json(timeline, 201);
});

timelinesRoutes.get('/timelines/:id', async (c) => {
  const timeline = await service.getOwnTimeline(getUserId(c), c.req.param('id'));
  return c.json(timeline);
});

timelinesRoutes.patch('/timelines/:id', async (c) => {
  const body = updateTimelineSchema.parse(await c.req.json());
  const timeline = await service.updateOwnTimeline(getUserId(c), c.req.param('id'), body);
  return c.json(timeline);
});

timelinesRoutes.delete('/timelines/:id', async (c) => {
  await service.deleteOwnTimeline(getUserId(c), c.req.param('id'));
  return c.body(null, 204);
});

timelinesRoutes.get('/timelines/:id/content', async (c) => {
  const content = await contentService.getTimelineContent(getUserId(c), c.req.param('id'));
  return c.json(content);
});

timelinesRoutes.post('/timelines/:id/milestones', async (c) => {
  const body = linkMilestoneSchema.parse(await c.req.json());
  const result = await contentService.linkMilestoneToTimeline(getUserId(c), c.req.param('id'), body);
  return c.json(result, 201);
});

timelinesRoutes.patch('/timelines/:id/milestones/:milestoneId', async (c) => {
  const body = updateMilestoneLinkSchema.parse(await c.req.json());
  const ref = await contentService.updateMilestoneLink(
    getUserId(c),
    c.req.param('id'),
    c.req.param('milestoneId'),
    body,
  );
  return c.json(ref);
});

timelinesRoutes.delete('/timelines/:id/milestones/:milestoneId', async (c) => {
  await contentService.unlinkMilestoneFromTimeline(
    getUserId(c),
    c.req.param('id'),
    c.req.param('milestoneId'),
  );
  return c.body(null, 204);
});

timelinesRoutes.post('/timelines/:id/stages', async (c) => {
  const body = linkStageSchema.parse(await c.req.json());
  const result = await contentService.linkStageToTimeline(getUserId(c), c.req.param('id'), body);
  return c.json(result, 201);
});

timelinesRoutes.patch('/timelines/:id/stages/:stageId', async (c) => {
  const body = updateStageLinkSchema.parse(await c.req.json());
  const ref = await contentService.updateStageLink(
    getUserId(c),
    c.req.param('id'),
    c.req.param('stageId'),
    body,
  );
  return c.json(ref);
});

timelinesRoutes.delete('/timelines/:id/stages/:stageId', async (c) => {
  await contentService.unlinkStageFromTimeline(getUserId(c), c.req.param('id'), c.req.param('stageId'));
  return c.body(null, 204);
});
