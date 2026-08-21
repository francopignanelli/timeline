import type { PartialDate, Timeline } from '@timeline/shared';
import { comparePartialDates, formatDateString } from '@timeline/shared';

export function todayPartialDate(): PartialDate {
  const now = new Date();
  return {
    date: formatDateString({
      day: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      year: now.getUTCFullYear(),
    }),
    precision: 'DAY',
  };
}

/** A Stage with no end date is still bounded *for comparison purposes* by today — it just can't be pinned to a fixed date yet. */
export function stageEffectiveEnd(stage: { end?: PartialDate; ongoing: boolean }): PartialDate {
  return stage.ongoing ? todayPartialDate() : (stage.end ?? todayPartialDate());
}

export interface BoundaryPatch {
  start?: PartialDate;
  end?: PartialDate;
}

/**
 * Whether linking (or creating) an item spanning [itemStart, itemEnd] on
 * `timeline` requires widening the timeline's own start/end so the item
 * isn't silently clipped off the canvas the moment it's attached — the
 * canvas only ever renders content inside [timeline.start, today]
 * (apps/web canvas-items.ts). `itemEnd` omitted means a point in time
 * (a Milestone); pass it for a Stage's span.
 *
 * Returns only the field(s) that actually need to change, or `null` if the
 * timeline already covers the item. An ongoing timeline's `end` is never
 * touched — it stays open-ended by definition, regardless of the item.
 */
export function expandedBounds(
  timeline: Pick<Timeline, 'start' | 'end' | 'ongoing'>,
  itemStart: PartialDate,
  itemEnd?: PartialDate,
): BoundaryPatch | null {
  const patch: BoundaryPatch = {};

  if (comparePartialDates(itemStart, timeline.start) < 0) {
    patch.start = itemStart;
  }

  if (!timeline.ongoing && timeline.end) {
    const effectiveItemEnd = itemEnd ?? itemStart;
    if (comparePartialDates(effectiveItemEnd, timeline.end) > 0) {
      patch.end = effectiveItemEnd;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
