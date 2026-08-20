import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, Timeline } from '@timeline/shared';

const timelinesRepo = vi.hoisted(() => ({
  getTimelineIdByShareToken: vi.fn(),
  getTimeline: vi.fn(),
}));
vi.mock('../../repositories/timelines-repo', () => timelinesRepo);

const linksRepo = vi.hoisted(() => ({
  listTimelineLinks: vi.fn(),
  batchGetMilestones: vi.fn(),
  batchGetStages: vi.fn(),
}));
vi.mock('../../repositories/links-repo', () => linksRepo);

vi.mock('../access/service', () => ({ requireTimeline: vi.fn() }));

const { getPublicTimelineMeta, getPublicContent, publicMediaKeysByBlockId } = await import(
  './service'
);

const OWNER_SUB = '64182408-e0a1-7054-0123-e9a252d5e985';

const timeline: Timeline = {
  id: 't1',
  ownerId: OWNER_SUB,
  title: 'Public one',
  start: { date: '01/01/2020', precision: 'YEAR' },
  ongoing: true,
  unit: 'YEARS',
  rulerVisible: true,
  visibility: 'PUBLIC',
  shareToken: 'tok',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const milestone: Milestone = {
  id: 'm1',
  ownerId: OWNER_SUB,
  title: 'With media',
  date: { date: '01/01/2021', precision: 'YEAR' },
  blocks: [
    { id: 'b1', type: 'TEXT', order: 0, text: 'hi @ana' },
    {
      id: 'b2',
      type: 'IMAGE',
      order: 1,
      s3Key: `u/${OWNER_SUB}/01ABC.png`,
      fileName: 'p.png',
      contentType: 'image/png',
      size: 70,
    },
  ],
  mentions: [{ userId: 'user-ana', username: 'ana' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('public read path', () => {
  it('404s an unknown token', async () => {
    timelinesRepo.getTimelineIdByShareToken.mockResolvedValue(null);
    await expect(getPublicTimelineMeta('nope')).rejects.toMatchObject({ status: 404 });
  });

  it('404s a token whose timeline has been made private again', async () => {
    timelinesRepo.getTimelineIdByShareToken.mockResolvedValue('t1');
    timelinesRepo.getTimeline.mockResolvedValue({ ...timeline, visibility: 'PRIVATE' });
    await expect(getPublicTimelineMeta('tok')).rejects.toMatchObject({ status: 404 });
  });

  it('strips ownerId and shareToken from the timeline payload', async () => {
    timelinesRepo.getTimelineIdByShareToken.mockResolvedValue('t1');
    timelinesRepo.getTimeline.mockResolvedValue(timeline);

    const result = await getPublicTimelineMeta('tok');
    expect(result).not.toHaveProperty('ownerId');
    expect(result).not.toHaveProperty('shareToken');
    expect(result.title).toBe('Public one');
  });

  it('never leaks the owner id or an object key through content', async () => {
    timelinesRepo.getTimelineIdByShareToken.mockResolvedValue('t1');
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    linksRepo.listTimelineLinks.mockResolvedValue({
      milestoneRefs: [{ timelineId: 't1', milestoneId: 'm1' }],
      stageRefs: [],
    });
    linksRepo.batchGetMilestones.mockResolvedValue(new Map([['m1', milestone]]));
    linksRepo.batchGetStages.mockResolvedValue(new Map());

    const content = await getPublicContent('tok');
    const serialized = JSON.stringify(content);

    // The whole payload must not contain the owner's subject in any form.
    expect(serialized).not.toContain(OWNER_SUB);
    expect(serialized).not.toContain('s3Key');
    expect(content.milestones[0]?.milestone).not.toHaveProperty('ownerId');
    // Mentions survive as usernames only — no user ids.
    expect(content.milestones[0]?.milestone.mentions).toEqual([{ username: 'ana' }]);
    expect(serialized).not.toContain('user-ana');
  });

  it('maps block ids to keys so the client never handles an object key', async () => {
    timelinesRepo.getTimelineIdByShareToken.mockResolvedValue('t1');
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    linksRepo.listTimelineLinks.mockResolvedValue({
      milestoneRefs: [{ timelineId: 't1', milestoneId: 'm1' }],
      stageRefs: [],
    });
    linksRepo.batchGetMilestones.mockResolvedValue(new Map([['m1', milestone]]));

    const map = await publicMediaKeysByBlockId('tok');
    expect(map.get('b2')).toBe(`u/${OWNER_SUB}/01ABC.png`);
    // Text blocks carry no media and must not appear.
    expect(map.has('b1')).toBe(false);
  });
});
