import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Milestone } from '@timeline/shared';

const repoMocks = vi.hoisted(() => ({
  listMilestonesByOwner: vi.fn(),
  getMilestone: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
}));
vi.mock('../../repositories/milestones-repo', () => repoMocks);

const accessMocks = vi.hoisted(() => ({ requireMilestone: vi.fn() }));
vi.mock('../access/service', () => accessMocks);

const linksRepoMocks = vi.hoisted(() => ({
  listMilestoneRefs: vi.fn().mockResolvedValue([]),
  batchGetMilestones: vi.fn(),
}));
vi.mock('../../repositories/links-repo', () => linksRepoMocks);

const membersRepoMocks = vi.hoisted(() => ({
  listMembers: vi.fn().mockResolvedValue([]),
  listMembershipsForUser: vi.fn(),
}));
vi.mock('../../repositories/members-repo', () => membersRepoMocks);

const usersRepoMocks = vi.hoisted(() => ({ getUsersByUsernames: vi.fn().mockResolvedValue([]) }));
vi.mock('../../repositories/users-repo', () => usersRepoMocks);

const ddbMocks = vi.hoisted(() => ({ ddb: { send: vi.fn() }, tableName: () => 'test-table' }));
vi.mock('../../repositories/dynamo-client', () => ddbMocks);

const uploadsServiceMocks = vi.hoisted(() => ({ deleteObjects: vi.fn() }));
vi.mock('../uploads/service', () => uploadsServiceMocks);

const { updateOwnMilestone, deleteOwnMilestone } = await import('./service');

const OWNER = 'owner-1';

function milestoneWith(blocks: Milestone['blocks']): Milestone {
  return {
    id: 'm1',
    ownerId: OWNER,
    title: 'A show',
    date: { date: '01/01/2022', precision: 'YEAR' },
    blocks,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const imageBlock = (id: string, key: string) => ({
  id,
  type: 'IMAGE' as const,
  order: 0,
  s3Key: key,
  fileName: 'p.png',
  contentType: 'image/png' as const,
  size: 10,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('updateOwnMilestone — upload cleanup', () => {
  it('deletes the S3 object for a block removed from the update', async () => {
    const existing = milestoneWith([imageBlock('b1', 'u/owner-1/removed.png')]);
    accessMocks.requireMilestone.mockResolvedValue(existing);
    repoMocks.updateMilestone.mockResolvedValue({ ...existing, blocks: [] });

    await updateOwnMilestone(OWNER, 'm1', { blocks: [] });

    expect(uploadsServiceMocks.deleteObjects).toHaveBeenCalledWith(['u/owner-1/removed.png']);
  });

  it('keeps a block that survives the update untouched', async () => {
    const kept = imageBlock('b1', 'u/owner-1/kept.png');
    const existing = milestoneWith([kept]);
    accessMocks.requireMilestone.mockResolvedValue(existing);
    repoMocks.updateMilestone.mockResolvedValue(existing);

    await updateOwnMilestone(OWNER, 'm1', { blocks: [kept] });

    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });

  it('does nothing when the update does not touch blocks at all', async () => {
    const existing = milestoneWith([imageBlock('b1', 'u/owner-1/untouched.png')]);
    accessMocks.requireMilestone.mockResolvedValue(existing);
    repoMocks.updateMilestone.mockResolvedValue(existing);

    await updateOwnMilestone(OWNER, 'm1', { title: 'Renamed' });

    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });
});

describe('deleteOwnMilestone — upload cleanup', () => {
  it('deletes every uploaded block only after the DB transaction succeeds', async () => {
    const existing = milestoneWith([
      imageBlock('b1', 'u/owner-1/one.png'),
      { id: 'b2', type: 'TEXT', order: 1, text: 'no upload here' },
    ]);
    repoMocks.getMilestone.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockResolvedValue({});

    await deleteOwnMilestone(OWNER, 'm1');

    expect(ddbMocks.ddb.send).toHaveBeenCalled();
    expect(uploadsServiceMocks.deleteObjects).toHaveBeenCalledWith(['u/owner-1/one.png']);
  });

  it('does not touch S3 if the DB transaction fails', async () => {
    const existing = milestoneWith([imageBlock('b1', 'u/owner-1/one.png')]);
    repoMocks.getMilestone.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockRejectedValue(new Error('transaction failed'));

    await expect(deleteOwnMilestone(OWNER, 'm1')).rejects.toThrow('transaction failed');
    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });

  it('is a no-op for a milestone with no upload blocks', async () => {
    const existing = milestoneWith([{ id: 'b1', type: 'TEXT', order: 0, text: 'just words' }]);
    repoMocks.getMilestone.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockResolvedValue({});

    await deleteOwnMilestone(OWNER, 'm1');

    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });
});
