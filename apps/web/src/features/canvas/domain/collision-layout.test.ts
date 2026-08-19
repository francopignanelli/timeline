import { describe, it, expect } from 'vitest';
import { assignMilestoneLevels } from './collision-layout';

// Footprint helper: label extends ~150px right of the dot, 14px to its left.
const extent = (id: string, day: number, width = 150) => ({
  id,
  day,
  startOffsetPx: -14,
  endOffsetPx: width,
});

describe('assignMilestoneLevels', () => {
  it('keeps milestones at level 0 when their labels fit side by side', () => {
    const levels = assignMilestoneLevels([extent('a', 0), extent('b', 200)], 1);
    expect(levels.get('a')).toEqual({ level: 0, showLabel: true });
    expect(levels.get('b')).toEqual({ level: 0, showLabel: true });
  });

  it('lifts a milestone whose label would overlap its neighbor', () => {
    // 100px apart, but the label footprint is 150px wide.
    const levels = assignMilestoneLevels([extent('a', 0), extent('b', 100)], 1);
    expect(levels.get('a')?.level).toBe(0);
    expect(levels.get('b')?.level).toBe(1);
  });

  it('is zoom-dependent: the same milestones separate when zoomed in', () => {
    const points = [extent('a', 0), extent('b', 4)];
    const far = assignMilestoneLevels(points, 1); // 4px apart → overlap
    const close = assignMilestoneLevels(points, 100); // 400px apart → fits
    expect(far.get('b')?.level).toBe(1);
    expect(close.get('b')?.level).toBe(0);
  });

  it('returns to level 0 once the earlier label has ended (no transitive towers)', () => {
    const levels = assignMilestoneLevels([extent('a', 0), extent('b', 100), extent('c', 250)], 1);
    expect(levels.get('a')?.level).toBe(0);
    expect(levels.get('b')?.level).toBe(1);
    expect(levels.get('c')?.level).toBe(0);
  });

  it('stacks same-day milestones on distinct levels, deterministically by id', () => {
    const levels = assignMilestoneLevels([extent('z', 10), extent('a', 10), extent('m', 10)], 1);
    expect(levels.get('a')?.level).toBe(0);
    expect(levels.get('m')?.level).toBe(1);
    expect(levels.get('z')?.level).toBe(2);
  });

  it('respects the minimum gap between footprints on a level', () => {
    const levels = assignMilestoneLevels([extent('a', 0, 100), extent('b', 105, 100)], 1, {
      minGapPx: 10,
    });
    expect(levels.get('b')?.level).toBe(1);
    const spaced = assignMilestoneLevels([extent('a', 0, 100), extent('b', 125, 100)], 1, {
      minGapPx: 10,
    });
    expect(spaced.get('b')?.level).toBe(0);
  });

  it('accounts for wider labels producing wider footprints', () => {
    const narrow = assignMilestoneLevels([extent('a', 0, 40), extent('b', 80, 40)], 1);
    expect(narrow.get('b')?.level).toBe(0);
    const wide = assignMilestoneLevels([extent('a', 0, 160), extent('b', 80, 160)], 1);
    expect(wide.get('b')?.level).toBe(1);
  });

  it('hides the label instead of exceeding maxLevels', () => {
    // Three colliding milestones but only two levels available.
    const levels = assignMilestoneLevels(
      [extent('a', 10), extent('b', 10), extent('c', 10)],
      1,
      { maxLevels: 2 },
    );
    expect(levels.get('a')).toEqual({ level: 0, showLabel: true });
    expect(levels.get('b')).toEqual({ level: 1, showLabel: true });
    expect(levels.get('c')?.showLabel).toBe(false);
    expect(levels.get('c')?.level).toBeLessThan(2);
  });

  it('fits a dot-only marker where the full label would not fit', () => {
    // a's footprint ends at 160; b at x=173: label start (159) collides,
    // dot start (161) fits — so b keeps level 0 as a dot-only marker.
    const levels = assignMilestoneLevels([extent('a', 0), extent('b', 173)], 1, {
      maxLevels: 1,
    });
    expect(levels.get('a')).toEqual({ level: 0, showLabel: true });
    expect(levels.get('b')).toEqual({ level: 0, showLabel: false });
  });

  it('recovers labels after crowded regions even at maxLevels 1', () => {
    const levels = assignMilestoneLevels(
      [extent('a', 0), extent('b', 100), extent('c', 200)],
      1,
      { maxLevels: 1 },
    );
    expect(levels.get('a')?.showLabel).toBe(true);
    expect(levels.get('b')?.showLabel).toBe(false); // no room anywhere → dot
    expect(levels.get('c')?.showLabel).toBe(true); // clear again → labeled
  });
});
