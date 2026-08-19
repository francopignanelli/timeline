import { describe, expect, it, vi } from 'vitest';
import type { Timeline } from '@timeline/shared';

const repoMocks = vi.hoisted(() => ({
  getTimeline: vi.fn(),
  listTimelinesByOwner: vi.fn(),
  createTimeline: vi.fn(),
  updateTimeline: vi.fn(),
  deleteTimeline: vi.fn(),
}));
vi.mock('../../repositories/timelines-repo', () => repoMocks);

const { getOwnTimeline, updateOwnTimeline, deleteOwnTimeline } = await import('./service');

const OWNER = 'owner-1';
const OTHER = 'owner-2';

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

describe('timelines authorization', () => {
  it('returns the timeline for its owner', async () => {
    repoMocks.getTimeline.mockResolvedValue(timeline);
    await expect(getOwnTimeline(OWNER, 't1')).resolves.toEqual(timeline);
  });

  it('404s for a non-owner (no existence leak)', async () => {
    repoMocks.getTimeline.mockResolvedValue(timeline);
    await expect(getOwnTimeline(OTHER, 't1')).rejects.toMatchObject({ status: 404 });
  });

  it('404s when the timeline does not exist at all', async () => {
    repoMocks.getTimeline.mockResolvedValue(null);
    await expect(getOwnTimeline(OWNER, 'missing')).rejects.toMatchObject({ status: 404 });
  });

  it('blocks a non-owner from updating', async () => {
    repoMocks.getTimeline.mockResolvedValue(timeline);
    await expect(updateOwnTimeline(OTHER, 't1', { title: 'Hijacked' })).rejects.toMatchObject({
      status: 404,
    });
    expect(repoMocks.updateTimeline).not.toHaveBeenCalled();
  });

  it('blocks a non-owner from deleting', async () => {
    repoMocks.getTimeline.mockResolvedValue(timeline);
    await expect(deleteOwnTimeline(OTHER, 't1')).rejects.toMatchObject({ status: 404 });
    expect(repoMocks.deleteTimeline).not.toHaveBeenCalled();
  });

  it('rejects an update that would make end precede start', async () => {
    repoMocks.getTimeline.mockResolvedValue({ ...timeline, ongoing: false });
    await expect(
      updateOwnTimeline(OWNER, 't1', { end: { date: '01/01/2019', precision: 'YEAR' } }),
    ).rejects.toThrow();
    expect(repoMocks.updateTimeline).not.toHaveBeenCalled();
  });
});
