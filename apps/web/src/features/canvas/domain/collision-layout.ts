/**
 * Milestone collision layout: label-width-aware level assignment with
 * graceful degradation.
 *
 * Each milestone occupies a horizontal pixel footprint (dot + label, offsets
 * relative to its own x). A greedy interval partitioning lifts a milestone to
 * the lowest level where its footprint fits, so labels never overlap and
 * vertical space is used only when needed. When `maxLevels` is exhausted, the
 * milestone degrades instead of overflowing: first it retries as a dot-only
 * marker (label hidden — existence stays visible), and as a last resort
 * (more same-position milestones than levels) dots may coincide visually.
 *
 * Zoom-dependent by design: recompute whenever pxPerDay changes.
 */

export interface MilestoneLabelExtent {
  id: string;
  day: number;
  /** Footprint start, in px relative to the milestone's x (usually negative). */
  startOffsetPx: number;
  /** Footprint end, in px relative to the milestone's x (dot + gap + label). */
  endOffsetPx: number;
}

export interface PlacedMilestone {
  level: number;
  showLabel: boolean;
}

/** Minimum clear horizontal space required between footprints on one level. */
export const LEVEL_MIN_GAP_PX = 10;

export interface LevelOptions {
  maxLevels?: number;
  dotWidthPx?: number;
  minGapPx?: number;
}

export function assignMilestoneLevels(
  extents: MilestoneLabelExtent[],
  pxPerDay: number,
  { maxLevels = Number.POSITIVE_INFINITY, dotWidthPx = 24, minGapPx = LEVEL_MIN_GAP_PX }: LevelOptions = {},
): Map<string, PlacedMilestone> {
  const intervals = extents
    .map((extent) => {
      const x = extent.day * pxPerDay;
      return {
        id: extent.id,
        x,
        fullStart: x + extent.startOffsetPx,
        fullEnd: x + extent.endOffsetPx + minGapPx,
      };
    })
    .sort((a, b) => a.fullStart - b.fullStart || a.id.localeCompare(b.id));

  const levelEnds: number[] = [];
  const placed = new Map<string, PlacedMilestone>();

  const tryPlace = (start: number, end: number): number => {
    for (let level = 0; level < levelEnds.length; level++) {
      const levelEnd = levelEnds[level];
      if (levelEnd !== undefined && levelEnd <= start) {
        levelEnds[level] = end;
        return level;
      }
    }
    if (levelEnds.length < maxLevels) {
      levelEnds.push(end);
      return levelEnds.length - 1;
    }
    return -1;
  };

  for (const interval of intervals) {
    const labeled = tryPlace(interval.fullStart, interval.fullEnd);
    if (labeled !== -1) {
      placed.set(interval.id, { level: labeled, showLabel: true });
      continue;
    }

    const dotStart = interval.x - dotWidthPx / 2;
    const dotEnd = interval.x + dotWidthPx / 2 + minGapPx;
    const dotOnly = tryPlace(dotStart, dotEnd);
    if (dotOnly !== -1) {
      placed.set(interval.id, { level: dotOnly, showLabel: false });
      continue;
    }

    // Last resort: overlap dots on the least-crowded level.
    let bestLevel = 0;
    let bestEnd = Number.POSITIVE_INFINITY;
    for (let level = 0; level < levelEnds.length; level++) {
      const levelEnd = levelEnds[level];
      if (levelEnd !== undefined && levelEnd < bestEnd) {
        bestEnd = levelEnd;
        bestLevel = level;
      }
    }
    levelEnds[bestLevel] = Math.max(bestEnd, dotEnd);
    placed.set(interval.id, { level: bestLevel, showLabel: false });
  }

  return placed;
}
