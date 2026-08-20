import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone, Timeline } from '@timeline/shared';

const timelinesRepo = vi.hoisted(() => ({ getTimeline: vi.fn(), batchGetTimelines: vi.fn() }));
vi.mock('../../repositories/timelines-repo', () => timelinesRepo);

const milestonesRepo = vi.hoisted(() => ({ getMilestone: vi.fn() }));
vi.mock('../../repositories/milestones-repo', () => milestonesRepo);

const stagesRepo = vi.hoisted(() => ({ getStage: vi.fn() }));
vi.mock('../../repositories/stages-repo', () => stagesRepo);

const linksRepo = vi.hoisted(() => ({ listMilestoneRefs: vi.fn(), listStageRefs: vi.fn() }));
vi.mock('../../repositories/links-repo', () => linksRepo);

const membersRepo = vi.hoisted(() => ({ getMember: vi.fn(), batchGetMemberships: vi.fn() }));
vi.mock('../../repositories/members-repo', () => membersRepo);

const { requireTimeline, requireMilestone } = await import('./service');

const OWNER = 'user-owner';
const EDITOR = 'user-editor';
const VIEWER = 'user-viewer';
const STRANGER = 'user-stranger';

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

const milestone: Milestone = {
  id: 'm1',
  ownerId: OWNER,
  title: 'A milestone',
  date: { date: '01/01/2021', precision: 'YEAR' },
  blocks: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const member = (userId: string, role: 'EDITOR' | 'VIEWER', resourceId = 't1') => ({
  scope: 'TIMELINE' as const,
  resourceId,
  userId,
  username: 'u',
  displayName: 'U',
  role,
  addedAt: '2026-01-01T00:00:00.000Z',
  addedBy: OWNER,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('timeline access', () => {
  it('grants the owner every capability', async () => {
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    membersRepo.getMember.mockResolvedValue(null);
    await expect(requireTimeline(OWNER, 't1', 'VIEW')).resolves.toEqual(timeline);
    await expect(requireTimeline(OWNER, 't1', 'EDIT')).resolves.toEqual(timeline);
    await expect(requireTimeline(OWNER, 't1', 'MANAGE')).resolves.toEqual(timeline);
  });

  it('lets an EDITOR edit but not manage', async () => {
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    membersRepo.getMember.mockResolvedValue(member(EDITOR, 'EDITOR'));
    await expect(requireTimeline(EDITOR, 't1', 'EDIT')).resolves.toEqual(timeline);
    await expect(requireTimeline(EDITOR, 't1', 'MANAGE')).rejects.toMatchObject({ status: 404 });
  });

  it('lets a VIEWER view but not edit', async () => {
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    membersRepo.getMember.mockResolvedValue(member(VIEWER, 'VIEWER'));
    await expect(requireTimeline(VIEWER, 't1', 'VIEW')).resolves.toEqual(timeline);
    await expect(requireTimeline(VIEWER, 't1', 'EDIT')).rejects.toMatchObject({ status: 404 });
  });

  it('404s a stranger on a private timeline', async () => {
    timelinesRepo.getTimeline.mockResolvedValue(timeline);
    membersRepo.getMember.mockResolvedValue(null);
    await expect(requireTimeline(STRANGER, 't1', 'VIEW')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the timeline does not exist', async () => {
    timelinesRepo.getTimeline.mockResolvedValue(null);
    await expect(requireTimeline(OWNER, 'missing', 'VIEW')).rejects.toMatchObject({ status: 404 });
  });

  it('lets any signed-in user READ a public timeline but never write it', async () => {
    timelinesRepo.getTimeline.mockResolvedValue({ ...timeline, visibility: 'PUBLIC' });
    membersRepo.getMember.mockResolvedValue(null);
    await expect(requireTimeline(STRANGER, 't1', 'VIEW')).resolves.toMatchObject({ id: 't1' });
    await expect(requireTimeline(STRANGER, 't1', 'EDIT')).rejects.toMatchObject({ status: 404 });
    await expect(requireTimeline(STRANGER, 't1', 'MANAGE')).rejects.toMatchObject({ status: 404 });
  });
});

describe('milestone access', () => {
  it('grants the milestone owner directly, without consulting timelines', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    await expect(requireMilestone(OWNER, 'm1', 'EDIT')).resolves.toEqual(milestone);
    expect(linksRepo.listMilestoneRefs).not.toHaveBeenCalled();
  });

  it('honours a milestone-scoped membership on its own', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    membersRepo.getMember.mockResolvedValue({ ...member(EDITOR, 'EDITOR', 'm1'), scope: 'MILESTONE' });
    await expect(requireMilestone(EDITOR, 'm1', 'EDIT')).resolves.toEqual(milestone);
    expect(linksRepo.listMilestoneRefs).not.toHaveBeenCalled();
  });

  it('grants edit through a timeline the caller can edit (DECISIONS #35)', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    membersRepo.getMember.mockResolvedValue(null);
    linksRepo.listMilestoneRefs.mockResolvedValue([{ timelineId: 't1', milestoneId: 'm1' }]);
    membersRepo.batchGetMemberships.mockResolvedValue(new Map([['t1', member(EDITOR, 'EDITOR')]]));
    timelinesRepo.batchGetTimelines.mockResolvedValue(new Map([['t1', timeline]]));

    await expect(requireMilestone(EDITOR, 'm1', 'EDIT')).resolves.toEqual(milestone);
  });

  it('does not grant edit through a timeline where the caller is only a VIEWER', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    membersRepo.getMember.mockResolvedValue(null);
    linksRepo.listMilestoneRefs.mockResolvedValue([{ timelineId: 't1', milestoneId: 'm1' }]);
    membersRepo.batchGetMemberships.mockResolvedValue(new Map([['t1', member(VIEWER, 'VIEWER')]]));
    timelinesRepo.batchGetTimelines.mockResolvedValue(new Map([['t1', timeline]]));

    await expect(requireMilestone(VIEWER, 'm1', 'EDIT')).rejects.toMatchObject({ status: 404 });
  });

  it('404s a stranger even when the milestone is linked somewhere', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    membersRepo.getMember.mockResolvedValue(null);
    linksRepo.listMilestoneRefs.mockResolvedValue([{ timelineId: 't1', milestoneId: 'm1' }]);
    membersRepo.batchGetMemberships.mockResolvedValue(new Map());
    timelinesRepo.batchGetTimelines.mockResolvedValue(new Map([['t1', timeline]]));

    await expect(requireMilestone(STRANGER, 'm1', 'VIEW')).rejects.toMatchObject({ status: 404 });
  });

  it('404s an orphan milestone the caller does not own', async () => {
    milestonesRepo.getMilestone.mockResolvedValue(milestone);
    membersRepo.getMember.mockResolvedValue(null);
    linksRepo.listMilestoneRefs.mockResolvedValue([]);
    await expect(requireMilestone(STRANGER, 'm1', 'VIEW')).rejects.toMatchObject({ status: 404 });
  });
});
