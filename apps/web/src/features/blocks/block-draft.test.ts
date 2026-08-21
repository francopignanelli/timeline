import { describe, expect, it } from 'vitest';
import type { ContentBlock } from '@timeline/shared';
import { moveBlock, moveBlockBefore, newBlock, resolveBlocks } from './block-draft';

const text = (id: string, order: number, body = ''): ContentBlock => ({
  id,
  type: 'TEXT',
  order,
  text: body,
});

describe('moveBlock', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item forward', () => {
    expect(moveBlock(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveBlock(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the list untouched for a no-op or out-of-range move', () => {
    expect(moveBlock(items, 1, 1)).toEqual(items);
    expect(moveBlock(items, -1, 2)).toEqual(items);
    expect(moveBlock(items, 0, 9)).toEqual(items);
  });

  it('does not mutate the input', () => {
    const original = [...items];
    moveBlock(items, 0, 3);
    expect(items).toEqual(original);
  });
});

describe('moveBlockBefore', () => {
  it('drops the dragged block at the target position', () => {
    const blocks = [text('a', 0), text('b', 1), text('c', 2)];
    expect(moveBlockBefore(blocks, 'c', 'a').map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('resolveBlocks', () => {
  it('renumbers order to the on-screen sequence', () => {
    const blocks = [text('a', 7), text('b', 3), text('c', 99)];
    const result = resolveBlocks(blocks, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it('resolves a pasted URL to a validated id', () => {
    const blocks = [newBlock('SETLIST', 0, 's')];
    const result = resolveBlocks(blocks, {
      s: 'https://www.setlist.fm/setlist/miranda/2025/estadio-1a2b3c.html',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks[0]).toMatchObject({ type: 'SETLIST', setlistId: '1a2b3c' });
  });

  it('drops an embed whose URL the user cleared, instead of blocking the save', () => {
    const blocks = [text('a', 0, 'keep me'), newBlock('SETLIST', 1, 's')];
    const result = resolveBlocks(blocks, { s: '   ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks.map((b) => b.id)).toEqual(['a']);
  });

  it('drops an embed block that was added but never filled in', () => {
    const result = resolveBlocks([newBlock('YOUTUBE', 0, 'v')], {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks).toEqual([]);
  });

  it('still reports a genuinely malformed URL', () => {
    const result = resolveBlocks([newBlock('SETLIST', 0, 's')], { s: 'https://example.com/x' });
    expect(result).toEqual({ ok: false, reason: 'SETLIST' });
  });

  it('keeps a stored id when the field was never touched', () => {
    const blocks: ContentBlock[] = [{ id: 'v', type: 'YOUTUBE', order: 0, youtubeId: 'dQw4w9WgXcQ' }];
    const result = resolveBlocks(blocks, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks[0]).toMatchObject({ youtubeId: 'dQw4w9WgXcQ' });
  });

  it('keeps empty text blocks, which are content the user can still fill in', () => {
    const result = resolveBlocks([text('a', 0, '')], {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blocks).toHaveLength(1);
  });
});
