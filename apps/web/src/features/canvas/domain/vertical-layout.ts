/**
 * Vertical layout policy for the canvas: where the axis sits and where each
 * milestone level lands, so available height is used on both sides of the
 * axis and content keeps clear padding from the edges.
 *
 * - With stages: the below-axis zone belongs to stage lanes (connectors must
 *   never cross bands), so the axis moves DOWN to exactly what stages need
 *   (clamped), giving milestones the rest above.
 * - Without stages: the axis centers and milestone levels alternate
 *   above/below, halving tower height and balancing the composition.
 */

export const STAGE_TOP_OFFSET = 36; // below the axis and ruler labels
export const STAGE_HEIGHT = 24;
export const STAGE_GAP = 8;

export const MILESTONE_BASE_OFFSET = 48; // axis → level-0 dot center (above)
export const MILESTONE_LEVEL_STEP = 40;
const BELOW_BASE_OFFSET = 60; // first below-axis dot clears the ruler band
const TOP_PAD = 36;
const BOTTOM_PAD = 36;
const AXIS_MIN_RATIO = 0.4;
const AXIS_MAX_RATIO = 0.72;

export interface VerticalLayout {
  axisY: number;
  aboveTiers: number;
  belowTiers: number;
  /** Hard cap on milestone levels — beyond it, labels degrade to dot-only. */
  maxLevels: number;
  /** Dot-center y for a level index (alternates above/below when both exist). */
  levelY: (level: number) => number;
}

export function computeVerticalLayout(height: number, stageLaneCount: number): VerticalLayout {
  let axisY: number;
  let belowTiers: number;

  if (stageLaneCount > 0) {
    const stageZoneBottom =
      STAGE_TOP_OFFSET + stageLaneCount * (STAGE_HEIGHT + STAGE_GAP) - STAGE_GAP;
    const ideal = height - stageZoneBottom - BOTTOM_PAD;
    axisY = Math.round(Math.min(Math.max(ideal, height * AXIS_MIN_RATIO), height * AXIS_MAX_RATIO));
    belowTiers = 0;
  } else {
    axisY = Math.round(height / 2);
    belowTiers = Math.max(
      0,
      Math.floor((height - axisY - BELOW_BASE_OFFSET - BOTTOM_PAD) / MILESTONE_LEVEL_STEP) + 1,
    );
  }

  const aboveTiers = Math.max(
    1,
    Math.floor((axisY - MILESTONE_BASE_OFFSET - TOP_PAD) / MILESTONE_LEVEL_STEP) + 1,
  );

  const interleaved = 2 * Math.min(aboveTiers, belowTiers);

  const levelY = (level: number): number => {
    let side: 'above' | 'below';
    let tier: number;
    if (level < interleaved) {
      side = level % 2 === 0 ? 'above' : 'below';
      tier = Math.floor(level / 2);
    } else {
      side = aboveTiers > belowTiers ? 'above' : 'below';
      tier = Math.min(aboveTiers, belowTiers) + (level - interleaved);
    }
    return side === 'above'
      ? axisY - MILESTONE_BASE_OFFSET - tier * MILESTONE_LEVEL_STEP
      : axisY + BELOW_BASE_OFFSET + tier * MILESTONE_LEVEL_STEP;
  };

  return { axisY, aboveTiers, belowTiers, maxLevels: aboveTiers + belowTiers, levelY };
}
