import {
  collectReferencedS3Keys,
  deletePendingUploadRecords,
  scanPendingUploads,
} from '../../repositories/uploads-repo';
import { deleteObjects, ORPHAN_UPLOAD_GRACE_DAYS } from './service';

const GRACE_MS = ORPHAN_UPLOAD_GRACE_DAYS * 24 * 60 * 60 * 1000;

export interface CleanupResult {
  scanned: number;
  deleted: number;
}

/**
 * Reclaims uploads that were presigned but never attached to a saved
 * milestone/stage (e.g. the user picked a file, it uploaded, then they closed
 * the editor without saving). Invoked daily via EventBridge (see
 * infra/lib/api-stack.ts) — reuses the same Lambda rather than a second
 * function, so it costs one extra invocation a day, not new compute.
 *
 * Safety rule: a key is only ever deleted if it is BOTH past the grace period
 * AND absent from `collectReferencedS3Keys()` — the live set of keys any
 * current milestone/stage actually references, recomputed fresh on every run.
 * That set, not any "was this confirmed" flag a write path might have missed,
 * is what a key is checked against, so a bug in the write path can make
 * cleanup run late (the tracking record and object linger a bit longer) but
 * can never make it delete something still in use.
 */
export async function runUploadCleanup(): Promise<CleanupResult> {
  const cutoff = Date.now() - GRACE_MS;

  const [pending, referenced] = await Promise.all([scanPendingUploads(), collectReferencedS3Keys()]);

  const toDelete = pending.filter(
    (u) => new Date(u.createdAt).getTime() < cutoff && !referenced.has(u.key),
  );

  if (toDelete.length > 0) {
    await deleteObjects(toDelete.map((u) => u.key));
    await deletePendingUploadRecords(toDelete.map((u) => u.key));
  }

  return { scanned: pending.length, deleted: toDelete.length };
}
