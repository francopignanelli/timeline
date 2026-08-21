import { describe, expect, it } from 'vitest';
import { truncateToWidth } from './measure-text';

// No `document` in this test environment, so measureTextWidth falls back to
// a fixed 8px/char — deterministic, which is exactly what makes this testable.
const CHAR_PX = 8;

describe('truncateToWidth', () => {
  it('returns the text unchanged when it already fits', () => {
    expect(truncateToWidth('Short', 10 * CHAR_PX, 'irrelevant')).toBe('Short');
  });

  it('truncates with an ellipsis when it does not fit', () => {
    const result = truncateToWidth('A rather long title indeed', 10 * CHAR_PX, 'irrelevant');
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan('A rather long title indeed'.length);
  });

  it('truncates to the longest prefix that still fits, not a fixed character count', () => {
    // At 5 chars of width, "ello…" (5 chars incl. ellipsis) is the longest that fits.
    const result = truncateToWidth('Hello World', 5 * CHAR_PX, 'irrelevant');
    expect(result).toBe('Hell…');
  });

  it('never grows past maxWidth', () => {
    const text = 'Something considerably longer than the box';
    const maxWidth = 6 * CHAR_PX;
    const result = truncateToWidth(text, maxWidth, 'irrelevant');
    // The fallback measurer is exactly length*CHAR_PX, so this checks the
    // same invariant the binary search enforces against the real measurer.
    expect(result.length * CHAR_PX).toBeLessThanOrEqual(maxWidth);
  });

  it('falls back to a bare ellipsis when even one character does not fit', () => {
    expect(truncateToWidth('Hello', 1, 'irrelevant')).toBe('…');
  });
});
