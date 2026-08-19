import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, Timeline } from '@timeline/shared';

const timelinesServiceMocks = vi.hoisted(() => ({ getOwnTimeline: vi.fn() }));
vi.mock('./service', () => timelinesServiceMocks);

const milestonesServiceMocks = vi.hoisted(() => ({
  getOwnMilestone: vi.fn(),
  createMilestone: vi.fn(),
}));
vi.mock('../milestones/service', () => milestonesServiceMocks);

const stagesServiceMocks = vi.hoisted(() => ({ getOwnStage: vi.fn(), createStage: vi.fn() }));
vi.mock('../stages/service', () => stagesServiceMocks);

const linksRepoMocks = vi.hoisted(() => ({
  listTimelineLinks: vi.fn(),
  linkMilestone: vi.fn(),
  linkStage: vi.fn(),
}));
vi.mock('../../repositories/links-repo', () => linksRepoMocks);

const { linkMilestoneToTimeline } = await import('./content-service');

const OWNER = 'owner-1';

const timeline: Timeline = {
  id: 't1',
  ownerId: OWNER,
  title: 'Mine',
  start: { date: '01/01/2020', precision: 'YEAR' },
  ongoing: true,
  unit: 'YEARS',
  rulerVisible: true,
  visibility: 'PRIVATE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('linking a milestone the caller owns their timeline', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('links an existing milestone the caller also owns', async () => {
    timelinesServiceMocks.getOwnTimeline.mockResolvedValue(timeline);
    const milestone: Milestone = {
      id: 'm1',
      ownerId: OWNER,
      title: 'Mine too',
      date: { date: '01/01/2021', precision: 'YEAR' },
      blocks: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    milestonesServiceMocks.getOwnMilestone.mockResolvedValue(milestone);
    linksRepoMocks.listTimelineLinks.mockResolvedValue({ milestoneRefs: [], stageRefs: [] });
    linksRepoMocks.linkMilestone.mockResolvedValue({
      timelineId: 't1',
      milestoneId: 'm1',
      displayOrder: 0,
      isHighlighted: false,
      isHidden: false,
      addedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await linkMilestoneToTimeline(OWNER, 't1', { milestoneId: 'm1' });
    expect(result.milestone).toEqual(milestone);
    expect(milestonesServiceMocks.getOwnMilestone).toHaveBeenCalledWith(OWNER, 'm1');
  });

  it('refuses to link a milestone owned by someone else (404 from the ownership check)', async () => {
    timelinesServiceMocks.getOwnTimeline.mockResolvedValue(timeline);
    milestonesServiceMocks.getOwnMilestone.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );

    await expect(linkMilestoneToTimeline(OWNER, 't1', { milestoneId: 'someone-elses' })).rejects.toMatchObject(
      { status: 404 },
    );
    expect(linksRepoMocks.linkMilestone).not.toHaveBeenCalled();
  });

  it('refuses to link into a timeline the caller does not own', async () => {
    timelinesServiceMocks.getOwnTimeline.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );

    await expect(linkMilestoneToTimeline(OWNER, 'someone-elses-timeline', { milestoneId: 'm1' })).rejects.toMatchObject(
      { status: 404 },
    );
    expect(milestonesServiceMocks.getOwnMilestone).not.toHaveBeenCalled();
    expect(linksRepoMocks.linkMilestone).not.toHaveBeenCalled();
  });
});
