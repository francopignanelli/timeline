/**
 * TimeScale: the bijective mapping between day numbers and canvas x pixels.
 * Pure data + pure functions; every layer consumes the same scale.
 */

export interface TimeScale {
  /** Zoom: horizontal pixels per day. */
  pxPerDay: number;
  /** Pan: the (fractional) day number rendered at x = 0. */
  startDay: number;
}

export const MIN_PX_PER_DAY = 0.002; // ~1,400 years across a 1,000px viewport
export const MAX_PX_PER_DAY = 240;

export function clampPxPerDay(value: number): number {
  return Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, value));
}

export function dayToX(scale: TimeScale, day: number): number {
  return (day - scale.startDay) * scale.pxPerDay;
}

export function xToDay(scale: TimeScale, x: number): number {
  return scale.startDay + x / scale.pxPerDay;
}

/** Zoom by `factor`, keeping the date under `anchorX` fixed on screen. */
export function zoomAt(scale: TimeScale, anchorX: number, factor: number): TimeScale {
  const pxPerDay = clampPxPerDay(scale.pxPerDay * factor);
  if (pxPerDay === scale.pxPerDay) return scale;
  const anchorDay = xToDay(scale, anchorX);
  return { pxPerDay, startDay: anchorDay - anchorX / pxPerDay };
}

/** Pan so the content moves `dx` pixels (drag right → dx > 0 → see earlier dates). */
export function panByPx(scale: TimeScale, dx: number): TimeScale {
  if (dx === 0) return scale;
  return { pxPerDay: scale.pxPerDay, startDay: scale.startDay - dx / scale.pxPerDay };
}

/** Fit [startDay, endDay] into the viewport with symmetric pixel padding. */
export function fitRange(
  startDay: number,
  endDay: number,
  viewportWidth: number,
  paddingPx = 64,
): TimeScale {
  const span = Math.max(1, endDay - startDay);
  const usable = Math.max(50, viewportWidth - paddingPx * 2);
  const pxPerDay = clampPxPerDay(usable / span);
  return { pxPerDay, startDay: startDay - paddingPx / pxPerDay };
}

export function visibleRange(
  scale: TimeScale,
  viewportWidth: number,
): { startDay: number; endDay: number } {
  return { startDay: scale.startDay, endDay: xToDay(scale, viewportWidth) };
}
