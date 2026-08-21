import { afterEach, describe, expect, it, vi } from 'vitest';

const uploadsRepoMocks = vi.hoisted(() => ({
  scanPendingUploads: vi.fn(),
  collectReferencedS3Keys: vi.fn(),
  deletePendingUploadRecords: vi.fn(),
}));
vi.mock('../../repositories/uploads-repo', () => uploadsRepoMocks);

const serviceMocks = vi.hoisted(() => ({ deleteObjects: vi.fn(), ORPHAN_UPLOAD_GRACE_DAYS: 2 }));
vi.mock('./service', () => serviceMocks);

const { runUploadCleanup } = await import('./cleanup');

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

afterEach(() => {
  vi.clearAllMocks();
});

describe('runUploadCleanup', () => {
  it('deletes an upload that is old enough and unreferenced', async () => {
    uploadsRepoMocks.scanPendingUploads.mockResolvedValue([
      { key: 'u/x/old.png', uploadedBy: 'u1', createdAt: isoDaysAgo(5) },
    ]);
    uploadsRepoMocks.collectReferencedS3Keys.mockResolvedValue(new Set());

    const result = await runUploadCleanup();

    expect(serviceMocks.deleteObjects).toHaveBeenCalledWith(['u/x/old.png']);
    expect(uploadsRepoMocks.deletePendingUploadRecords).toHaveBeenCalledWith(['u/x/old.png']);
    expect(result).toEqual({ scanned: 1, deleted: 1 });
  });

  it('never deletes a key that is still referenced by live content, no matter how old', async () => {
    uploadsRepoMocks.scanPendingUploads.mockResolvedValue([
      { key: 'u/x/still-used.png', uploadedBy: 'u1', createdAt: isoDaysAgo(30) },
    ]);
    uploadsRepoMocks.collectReferencedS3Keys.mockResolvedValue(new Set(['u/x/still-used.png']));

    const result = await runUploadCleanup();

    expect(serviceMocks.deleteObjects).not.toHaveBeenCalled();
    expect(uploadsRepoMocks.deletePendingUploadRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, deleted: 0 });
  });

  it('leaves a recent upload alone even if unreferenced, so an in-progress edit is never touched', async () => {
    uploadsRepoMocks.scanPendingUploads.mockResolvedValue([
      { key: 'u/x/just-now.png', uploadedBy: 'u1', createdAt: isoDaysAgo(0.01) },
    ]);
    uploadsRepoMocks.collectReferencedS3Keys.mockResolvedValue(new Set());

    const result = await runUploadCleanup();

    expect(serviceMocks.deleteObjects).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, deleted: 0 });
  });

  it('is a no-op when nothing is pending', async () => {
    uploadsRepoMocks.scanPendingUploads.mockResolvedValue([]);
    uploadsRepoMocks.collectReferencedS3Keys.mockResolvedValue(new Set());

    const result = await runUploadCleanup();

    expect(serviceMocks.deleteObjects).not.toHaveBeenCalled();
    expect(uploadsRepoMocks.deletePendingUploadRecords).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 0, deleted: 0 });
  });

  it('partitions a mixed batch correctly: only the old, unreferenced ones go', async () => {
    uploadsRepoMocks.scanPendingUploads.mockResolvedValue([
      { key: 'old-unreferenced', uploadedBy: 'u1', createdAt: isoDaysAgo(10) },
      { key: 'old-but-referenced', uploadedBy: 'u1', createdAt: isoDaysAgo(10) },
      { key: 'recent-unreferenced', uploadedBy: 'u1', createdAt: isoDaysAgo(0.1) },
    ]);
    uploadsRepoMocks.collectReferencedS3Keys.mockResolvedValue(new Set(['old-but-referenced']));

    const result = await runUploadCleanup();

    expect(serviceMocks.deleteObjects).toHaveBeenCalledWith(['old-unreferenced']);
    expect(result).toEqual({ scanned: 3, deleted: 1 });
  });
});
