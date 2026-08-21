import type { ContentBlock } from '@timeline/shared';
import { parseSetlistId, parseYouTubeId, youTubeWatchUrl } from '@timeline/shared';

/**
 * Pure editing operations over a list of content blocks, shared by the
 * Milestone and Stage editors. Kept framework-free so the reordering and
 * URL-resolution rules can be unit-tested without rendering anything.
 */

/** Kinds a user adds directly; IMAGE and FILE arrive through an upload. */
export type AddableBlockKind = 'TEXT' | 'YOUTUBE' | 'SETLIST';

/**
 * Raw URL text per block id, buffered while typing so a half-typed URL never
 * destroys the validated id already stored on the block.
 */
export type UrlDrafts = Record<string, string>;

export function newBlock(
  kind: AddableBlockKind,
  order: number,
  id: string = crypto.randomUUID(),
): ContentBlock {
  switch (kind) {
    case 'TEXT':
      return { id, type: 'TEXT', order, text: '' };
    case 'YOUTUBE':
      return { id, type: 'YOUTUBE', order, youtubeId: '' };
    case 'SETLIST':
      return { id, type: 'SETLIST', order, setlistId: '' };
  }
}

/** Moves one item; `order` is renumbered on save, so position is index alone. */
export function moveBlock<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

/** Moves the block with `id` to sit where `targetId` currently is. */
export function moveBlockBefore(
  blocks: readonly ContentBlock[],
  id: string,
  targetId: string,
): ContentBlock[] {
  return moveBlock(
    blocks,
    blocks.findIndex((b) => b.id === id),
    blocks.findIndex((b) => b.id === targetId),
  );
}

/**
 * Inserts a copy directly below the original.
 *
 * A duplicated media block deliberately keeps the same `s3Key`: the copy
 * references the object already in the bucket rather than re-uploading it, so
 * duplicating costs no extra storage.
 */
export function duplicateBlock(
  blocks: readonly ContentBlock[],
  urls: UrlDrafts,
  id: string,
  newId: string = crypto.randomUUID(),
): { blocks: ContentBlock[]; urls: UrlDrafts } {
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return { blocks: [...blocks], urls };

  const copy: ContentBlock = { ...blocks[index]!, id: newId };
  const nextBlocks = [...blocks];
  nextBlocks.splice(index + 1, 0, copy);

  const draft = urls[id];
  return {
    blocks: nextBlocks,
    urls: draft === undefined ? urls : { ...urls, [newId]: draft },
  };
}

export type ResolveResult =
  | { ok: true; blocks: ContentBlock[] }
  | { ok: false; reason: 'YOUTUBE' | 'SETLIST' };

/**
 * Turns the editing draft into blocks the API will accept: every pasted URL
 * becomes a validated id, and `order` is renumbered to the on-screen order so
 * the saved sequence is exactly what the user arranged.
 */
export function resolveBlocks(
  blocks: readonly ContentBlock[],
  urls: UrlDrafts,
): ResolveResult {
  const resolved: ContentBlock[] = [];

  for (const block of blocks) {
    if (block.type !== 'YOUTUBE' && block.type !== 'SETLIST') {
      resolved.push({ ...block, order: resolved.length });
      continue;
    }

    const stored = block.type === 'YOUTUBE' ? block.youtubeId : block.setlistId;
    // An absent draft means the field was never touched, so the stored id
    // stands; an empty draft means the user actually cleared it.
    const text = (urls[block.id] ?? stored).trim();

    /*
     * Clearing the URL removes the embed instead of failing validation. An
     * embed with no id cannot be saved at all, so reporting it as invalid
     * would trap the user in a form that can neither be saved nor emptied —
     * the only escape being a "remove" button they have no reason to look for.
     */
    if (text === '') continue;

    const parsed = block.type === 'YOUTUBE' ? parseYouTubeId(text) : parseSetlistId(text);
    if (!parsed) return { ok: false, reason: block.type };

    resolved.push(
      block.type === 'YOUTUBE'
        ? { ...block, order: resolved.length, youtubeId: parsed }
        : { ...block, order: resolved.length, setlistId: parsed },
    );
  }

  return { ok: true, blocks: resolved };
}

/**
 * Seeds the URL fields when an editor opens, so a saved embed shows something
 * editable rather than an empty box.
 *
 * A YouTube id round-trips through its canonical watch URL. A setlist id does
 * not: setlist.fm URLs embed an artist/venue slug we never stored, so the
 * field shows the bare id — which the parser accepts — instead of a plausible
 * looking URL that was never real.
 */
export function seedUrlDrafts(blocks: readonly ContentBlock[]): UrlDrafts {
  const drafts: UrlDrafts = {};
  for (const block of blocks) {
    if (block.type === 'YOUTUBE' && block.youtubeId) {
      drafts[block.id] = youTubeWatchUrl(block.youtubeId);
    } else if (block.type === 'SETLIST' && block.setlistId) {
      drafts[block.id] = block.setlistId;
    }
  }
  return drafts;
}
