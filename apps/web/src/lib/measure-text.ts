/**
 * Canvas-based text measurement for layout math (milestone label footprints).
 * Cached per font+text; the cache clears once real fonts finish loading so
 * early fallback-font measurements get corrected.
 */

let context: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

if (typeof document !== 'undefined' && 'fonts' in document) {
  void document.fonts.ready.then(() => cache.clear());
}

const FALLBACK_CHAR_PX = 8;

export function measureTextWidth(text: string, font: string): number {
  if (typeof document === 'undefined') return text.length * FALLBACK_CHAR_PX;
  if (!context) {
    context = document.createElement('canvas').getContext('2d');
  }
  if (!context) return text.length * FALLBACK_CHAR_PX;

  const key = `${font}|${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  context.font = font;
  const width = context.measureText(text).width;
  cache.set(key, width);
  return width;
}

/**
 * Truncates to the longest prefix (plus "…") that fits `maxWidth` at `font`
 * — for SVG `<text>`, which has no CSS `text-overflow: ellipsis` of its own.
 * Sized by actual rendered width, not a fixed character count, so a wide
 * character set or a narrow one both truncate at the same visual point.
 */
export function truncateToWidth(text: string, maxWidth: number, font: string): string {
  if (measureTextWidth(text, font) <= maxWidth) return text;

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, mid)}…`;
    if (measureTextWidth(candidate, font) <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? `${text.slice(0, low)}…` : '…';
}
