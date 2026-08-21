import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Stage } from '@timeline/shared';

const repoMocks = vi.hoisted(() => ({
  listStagesByOwner: vi.fn(),
  getStage: vi.fn(),
  createStage: vi.fn(),
  updateStage: vi.fn(),
}));
vi.mock('../../repositories/stages-repo', () => repoMocks);

const accessMocks = vi.hoisted(() => ({ requireStage: vi.fn() }));
vi.mock('../access/service', () => accessMocks);

const linksRepoMocks = vi.hoisted(() => ({ listStageRefs: vi.fn().mockResolvedValue([]) }));
vi.mock('../../repositories/links-repo', () => linksRepoMocks);

const membersRepoMocks = vi.hoisted(() => ({ listMembershipsForUser: vi.fn() }));
vi.mock('../../repositories/members-repo', () => membersRepoMocks);

const ddbMocks = vi.hoisted(() => ({ ddb: { send: vi.fn() }, tableName: () => 'test-table' }));
vi.mock('../../repositories/dynamo-client', () => ddbMocks);

const uploadsServiceMocks = vi.hoisted(() => ({ deleteObjects: vi.fn() }));
vi.mock('../uploads/service', () => uploadsServiceMocks);

const { updateOwnStage, deleteOwnStage } = await import('./service');

const OWNER = 'owner-1';

function stageWith(blocks: NonNullable<Stage['blocks']>): Stage {
  return {
    id: 's1',
    ownerId: OWNER,
    title: 'A period',
    start: { date: '01/01/2020', precision: 'YEAR' },
    ongoing: true,
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

describe('updateOwnStage — upload cleanup', () => {
  it('deletes the S3 object for a block removed from the update', async () => {
    const existing = stageWith([imageBlock('b1', 'u/owner-1/removed.png')]);
    accessMocks.requireStage.mockResolvedValue(existing);
    repoMocks.updateStage.mockResolvedValue({ ...existing, blocks: [] });

    await updateOwnStage(OWNER, 's1', { blocks: [] });

    expect(uploadsServiceMocks.deleteObjects).toHaveBeenCalledWith(['u/owner-1/removed.png']);
  });

  it('does nothing when the update does not touch blocks at all', async () => {
    const existing = stageWith([imageBlock('b1', 'u/owner-1/untouched.png')]);
    accessMocks.requireStage.mockResolvedValue(existing);
    repoMocks.updateStage.mockResolvedValue(existing);

    await updateOwnStage(OWNER, 's1', { title: 'Renamed' });

    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });
});

describe('deleteOwnStage — upload cleanup', () => {
  it('deletes every uploaded block only after the DB transaction succeeds', async () => {
    const existing = stageWith([imageBlock('b1', 'u/owner-1/one.png')]);
    repoMocks.getStage.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockResolvedValue({});

    await deleteOwnStage(OWNER, 's1');

    expect(uploadsServiceMocks.deleteObjects).toHaveBeenCalledWith(['u/owner-1/one.png']);
  });

  it('does not touch S3 if the DB transaction fails', async () => {
    const existing = stageWith([imageBlock('b1', 'u/owner-1/one.png')]);
    repoMocks.getStage.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockRejectedValue(new Error('transaction failed'));

    await expect(deleteOwnStage(OWNER, 's1')).rejects.toThrow('transaction failed');
    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });

  it('is a no-op for a stage with no blocks at all (pre-existing stages)', async () => {
    const existing = { ...stageWith([]), blocks: undefined };
    repoMocks.getStage.mockResolvedValue(existing);
    ddbMocks.ddb.send.mockResolvedValue({});

    await deleteOwnStage(OWNER, 's1');

    expect(uploadsServiceMocks.deleteObjects).not.toHaveBeenCalled();
  });
});

describe('updateOwnStage — ongoing clears the end date', () => {
  const ended: Stage = {
    ...stageWith([]),
    ongoing: false,
    end: { date: '31/12/2023', precision: 'DAY' },
  };

  it('removes a stale end date when the stage is switched to ongoing', async () => {
    accessMocks.requireStage.mockResolvedValue(ended);
    repoMocks.updateStage.mockResolvedValue({ ...ended, ongoing: true, end: undefined });

    // What the client actually sends: `end: undefined` never survives
    // JSON.stringify, so the body carries no `end` key at all.
    await updateOwnStage(OWNER, 's1', { ongoing: true });

    const [, writePatch, removals] = repoMocks.updateStage.mock.calls[0]!;
    expect(removals).toEqual(['end']);
    expect(writePatch).not.toHaveProperty('end');
  });

  it('does not reject the save even though the stored stage still has an end', async () => {
    accessMocks.requireStage.mockResolvedValue(ended);
    repoMocks.updateStage.mockResolvedValue({ ...ended, ongoing: true, end: undefined });

    // Regression: merging `ongoing: true` with the existing `end` used to
    // trip checkTemporalRange and throw before reaching the repository.
    await expect(updateOwnStage(OWNER, 's1', { ongoing: true })).resolves.toBeDefined();
  });

  it('keeps the end date when ongoing is turned back off', async () => {
    accessMocks.requireStage.mockResolvedValue({ ...ended, ongoing: true, end: undefined });
    repoMocks.updateStage.mockResolvedValue(ended);

    await updateOwnStage(OWNER, 's1', {
      ongoing: false,
      end: { date: '31/12/2023', precision: 'DAY' },
    });

    const [, writePatch, removals] = repoMocks.updateStage.mock.calls[0]!;
    expect(removals).toEqual([]);
    expect(writePatch).toMatchObject({ end: { date: '31/12/2023', precision: 'DAY' } });
  });
});
