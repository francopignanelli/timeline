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
