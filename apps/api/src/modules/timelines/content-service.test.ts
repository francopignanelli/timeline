import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, Timeline } from '@timeline/shared';

const accessMocks = vi.hoisted(() => ({ requireTimeline: vi.fn(), requireMilestone: vi.fn() }));
vi.mock('../access/service', () => accessMocks);

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

const timelinesServiceMocks = vi.hoisted(() => ({ updateOwnTimeline: vi.fn() }));
vi.mock('./service', () => timelinesServiceMocks);

const { linkMilestoneToTimeline, linkStageToTimeline } = await import('./content-service');

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
    accessMocks.requireTimeline.mockResolvedValue(timeline);
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
    accessMocks.requireTimeline.mockResolvedValue(timeline);
    milestonesServiceMocks.getOwnMilestone.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );

    await expect(linkMilestoneToTimeline(OWNER, 't1', { milestoneId: 'someone-elses' })).rejects.toMatchObject(
      { status: 404 },
    );
    expect(linksRepoMocks.linkMilestone).not.toHaveBeenCalled();
  });

  it('refuses to link into a timeline the caller does not own', async () => {
    accessMocks.requireTimeline.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );

    await expect(linkMilestoneToTimeline(OWNER, 'someone-elses-timeline', { milestoneId: 'm1' })).rejects.toMatchObject(
      { status: 404 },
    );
    expect(milestonesServiceMocks.getOwnMilestone).not.toHaveBeenCalled();
    expect(linksRepoMocks.linkMilestone).not.toHaveBeenCalled();
  });

  it('widens the timeline start when the linked milestone is dated earlier', async () => {
    accessMocks.requireTimeline.mockResolvedValue(timeline); // start: 01/01/2020, ongoing
    const early: Milestone = {
      id: 'm1',
      ownerId: OWNER,
      title: 'Before the timeline even started',
      date: { date: '01/01/2015', precision: 'YEAR' },
      blocks: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    milestonesServiceMocks.getOwnMilestone.mockResolvedValue(early);
    linksRepoMocks.listTimelineLinks.mockResolvedValue({ milestoneRefs: [], stageRefs: [] });
    linksRepoMocks.linkMilestone.mockResolvedValue({
      timelineId: 't1',
      milestoneId: 'm1',
      displayOrder: 0,
      isHighlighted: false,
      isHidden: false,
      addedAt: '2026-01-01T00:00:00.000Z',
    });

    await linkMilestoneToTimeline(OWNER, 't1', { milestoneId: 'm1' });

    expect(timelinesServiceMocks.updateOwnTimeline).toHaveBeenCalledWith(OWNER, 't1', {
      start: { date: '01/01/2015', precision: 'YEAR' },
    });
  });

  it('does not touch the timeline when the milestone already fits inside it', async () => {
    accessMocks.requireTimeline.mockResolvedValue(timeline);
    const inRange: Milestone = {
      id: 'm1',
      ownerId: OWNER,
      title: 'Fits fine',
      date: { date: '01/01/2021', precision: 'YEAR' },
      blocks: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    milestonesServiceMocks.getOwnMilestone.mockResolvedValue(inRange);
    linksRepoMocks.listTimelineLinks.mockResolvedValue({ milestoneRefs: [], stageRefs: [] });
    linksRepoMocks.linkMilestone.mockResolvedValue({
      timelineId: 't1',
      milestoneId: 'm1',
      displayOrder: 0,
      isHighlighted: false,
      isHidden: false,
      addedAt: '2026-01-01T00:00:00.000Z',
    });

    await linkMilestoneToTimeline(OWNER, 't1', { milestoneId: 'm1' });

    expect(timelinesServiceMocks.updateOwnTimeline).not.toHaveBeenCalled();
  });

  it('widens the timeline end when a linked stage runs later than it, but never touches an ongoing timeline’s end', async () => {
    accessMocks.requireTimeline.mockResolvedValue(timeline); // ongoing: true
    const stage = {
      id: 's1',
      ownerId: OWNER,
      title: 'Runs past 2020',
      start: { date: '01/01/2019', precision: 'YEAR' },
      end: { date: '01/01/2099', precision: 'YEAR' },
      ongoing: false,
      blocks: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    stagesServiceMocks.getOwnStage.mockResolvedValue(stage);
    linksRepoMocks.linkStage.mockResolvedValue({
      timelineId: 't1',
      stageId: 's1',
      isHighlighted: false,
      addedAt: '2026-01-01T00:00:00.000Z',
    });

    await linkStageToTimeline(OWNER, 't1', { stageId: 's1' });

    // The timeline is ongoing, so only start (2019 < 2020) widens — end never does.
    expect(timelinesServiceMocks.updateOwnTimeline).toHaveBeenCalledWith(OWNER, 't1', {
      start: { date: '01/01/2019', precision: 'YEAR' },
    });
  });
});
