import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Timeline } from '@timeline/shared';

const repoMocks = vi.hoisted(() => ({
  getTimeline: vi.fn(),
  listTimelinesByOwner: vi.fn(),
  batchGetTimelines: vi.fn(),
  createTimeline: vi.fn(),
  updateTimeline: vi.fn(),
  deleteTimeline: vi.fn(),
  deleteShareToken: vi.fn(),
}));
vi.mock('../../repositories/timelines-repo', () => repoMocks);

const membersRepo = vi.hoisted(() => ({ listMembershipsForUser: vi.fn() }));
vi.mock('../../repositories/members-repo', () => membersRepo);

// Authorization itself is covered in modules/access/service.test.ts; here we
// assert that this service refuses to act when access is denied.
const accessMocks = vi.hoisted(() => ({ requireTimeline: vi.fn() }));
vi.mock('../access/service', () => accessMocks);

const { updateOwnTimeline, deleteOwnTimeline, listAccessibleTimelines } = await import('./service');

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

const denied = () => Object.assign(new Error('not found'), { status: 404 });

afterEach(() => {
  vi.clearAllMocks();
});

describe('timelines service', () => {
  it('does not write when access is denied on update', async () => {
    accessMocks.requireTimeline.mockRejectedValue(denied());
    await expect(updateOwnTimeline('other', 't1', { title: 'Hijacked' })).rejects.toMatchObject({
      status: 404,
    });
    expect(repoMocks.updateTimeline).not.toHaveBeenCalled();
  });

  it('does not delete when access is denied', async () => {
    accessMocks.requireTimeline.mockRejectedValue(denied());
    await expect(deleteOwnTimeline('other', 't1')).rejects.toMatchObject({ status: 404 });
    expect(repoMocks.deleteTimeline).not.toHaveBeenCalled();
  });

  it('requires MANAGE (not merely EDIT) to delete', async () => {
    accessMocks.requireTimeline.mockResolvedValue(timeline);
    await deleteOwnTimeline(OWNER, 't1');
    expect(accessMocks.requireTimeline).toHaveBeenCalledWith(OWNER, 't1', 'MANAGE');
  });

  it('rejects an update that would make end precede start', async () => {
    accessMocks.requireTimeline.mockResolvedValue({ ...timeline, ongoing: false });
    await expect(
      updateOwnTimeline(OWNER, 't1', { end: { date: '01/01/2019', precision: 'YEAR' } }),
    ).rejects.toThrow();
    expect(repoMocks.updateTimeline).not.toHaveBeenCalled();
  });

  it('ignores visibility in a general PATCH — it belongs to the share endpoints', async () => {
    accessMocks.requireTimeline.mockResolvedValue(timeline);
    repoMocks.updateTimeline.mockResolvedValue(timeline);
    await updateOwnTimeline(OWNER, 't1', { title: 'Renamed', visibility: 'PUBLIC' });
    expect(repoMocks.updateTimeline).toHaveBeenCalledWith('t1', { title: 'Renamed' });
  });

  it('lists owned and shared timelines together, without duplicates', async () => {
    repoMocks.listTimelinesByOwner.mockResolvedValue([timeline]);
    membersRepo.listMembershipsForUser.mockResolvedValue([
      { resourceId: 't1' }, // already owned — must not duplicate
      { resourceId: 't2' },
    ]);
    repoMocks.batchGetTimelines.mockResolvedValue(
      new Map([['t2', { ...timeline, id: 't2', ownerId: 'someone-else' }]]),
    );

    const result = await listAccessibleTimelines(OWNER);
    expect(result.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(repoMocks.batchGetTimelines).toHaveBeenCalledWith(['t2']);
  });
});
