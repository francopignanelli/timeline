import { describe, it, expect } from 'vitest';
import {
  MILESTONE_BASE_OFFSET,
  MILESTONE_LEVEL_STEP,
  computeVerticalLayout,
} from './vertical-layout';

describe('computeVerticalLayout', () => {
  it('centers the axis and alternates levels above/below when there are no stages', () => {
    const layout = computeVerticalLayout(565, 0);
    expect(layout.axisY).toBe(283);
    expect(layout.aboveTiers).toBeGreaterThan(0);
    expect(layout.belowTiers).toBeGreaterThan(0);
    // level 0 above, level 1 below, level 2 above one tier higher…
    expect(layout.levelY(0)).toBeLessThan(layout.axisY);
    expect(layout.levelY(1)).toBeGreaterThan(layout.axisY);
    expect(layout.levelY(2)).toBe(layout.levelY(0) - MILESTONE_LEVEL_STEP);
    expect(layout.levelY(3)).toBe(layout.levelY(1) + MILESTONE_LEVEL_STEP);
  });

  it('moves the axis down and keeps milestones above when stages exist', () => {
    const layout = computeVerticalLayout(565, 2);
    expect(layout.belowTiers).toBe(0);
    expect(layout.axisY).toBeGreaterThan(283); // more room above than a centered axis
    expect(layout.axisY).toBeLessThanOrEqual(Math.round(565 * 0.72));
    for (let level = 0; level < layout.maxLevels; level++) {
      expect(layout.levelY(level)).toBeLessThan(layout.axisY);
    }
    expect(layout.levelY(1)).toBe(layout.levelY(0) - MILESTONE_LEVEL_STEP);
  });

  it('caps levels by available height with edge padding', () => {
    const layout = computeVerticalLayout(565, 0);
    expect(layout.maxLevels).toBe(layout.aboveTiers + layout.belowTiers);
    // Highest above level stays clear of the top edge…
    expect(layout.levelY(2 * layout.aboveTiers - 2)).toBeGreaterThanOrEqual(24);
    // …and the deepest below level stays clear of the bottom edge.
    const deepestBelow = layout.levelY(2 * layout.belowTiers - 1);
    expect(deepestBelow).toBeLessThanOrEqual(565 - 24);
  });

  it('keeps more lanes of stages pushing the axis up only to its clamp', () => {
    const few = computeVerticalLayout(565, 1);
    const many = computeVerticalLayout(565, 6);
    expect(many.axisY).toBeLessThan(few.axisY);
    expect(many.axisY).toBeGreaterThanOrEqual(Math.round(565 * 0.4));
  });

  it('always offers at least one level, even in tiny viewports', () => {
    const layout = computeVerticalLayout(200, 0);
    expect(layout.maxLevels).toBeGreaterThanOrEqual(1);
    expect(layout.levelY(0)).toBe(layout.axisY - MILESTONE_BASE_OFFSET);
  });
});
