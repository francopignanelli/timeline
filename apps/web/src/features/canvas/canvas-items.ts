import type {
  EntityColor,
  Milestone,
  Stage,
  Timeline,
  TimelineMilestoneRef,
  TimelineStageRef,
} from '@timeline/shared';
import { formatPartialDate } from '../../lib/format-date';
import { partialDateToDayNumber } from './domain/day-number';

/**
 * The canvas only needs what it draws — so it takes the structural minimum
 * rather than the full entity. That lets the authenticated payload and the
 * PII-stripped public one (which has no `ownerId` and no `s3Key`) feed the
 * exact same renderer.
 */
export interface CanvasContent {
  milestones: {
    ref: TimelineMilestoneRef;
    milestone: Pick<Milestone, 'id' | 'title' | 'shortLabel' | 'date'>;
  }[];
  stages: {
    ref: TimelineStageRef;
    stage: Pick<Stage, 'id' | 'title' | 'shortLabel' | 'start' | 'end' | 'ongoing'>;
  }[];
}

/** Presentation-ready canvas items: domain entities flattened to day numbers. */

export interface CanvasMilestone {
  id: string;
  day: number;
  /** Always the full name — for the accessible name and the hover tooltip. */
  title: string;
  /** What actually renders on the canvas: `shortLabel || title`. */
  label: string;
  dateLabel: string;
  isHighlighted: boolean;
  color: EntityColor | undefined;
}

export interface CanvasStage {
  id: string;
  /** Always the full name — for the accessible name and the hover tooltip. */
  title: string;
  /** What actually renders on the canvas: `shortLabel || title`. */
  label: string;
  startDay: number;
  endDay: number;
  ongoing: boolean;
  isHighlighted: boolean;
  color: EntityColor | undefined;
  rangeLabel: string;
}

export interface CanvasItems {
  milestones: CanvasMilestone[];
  stages: CanvasStage[];
  fitStart: number;
  fitEnd: number;
  /**
   * The only valid window for display: never before the timeline's start,
   * never after today. Every item above is already filtered/clipped to fall
   * inside it; layers that draw independently of items (the axis line, ruler
   * ticks) clip to it directly.
   */
  boundStart: number;
  boundEnd: number;
}

export function buildCanvasItems(
  timeline: Timeline,
  content: CanvasContent,
  today: number,
  locale: string,
  presentLabel: string,
): CanvasItems {
  const boundStart = partialDateToDayNumber(timeline.start) ?? today;
  // Always "now", regardless of whether the timeline itself has ended: a
  // completed timeline still lives in a world where nothing renders past the
  // present moment (product requirement, not a timeline-specific rule).
  const boundEnd = today;

  const milestones: CanvasMilestone[] = content.milestones
    .filter(({ ref }) => !ref.isHidden)
    .flatMap(({ ref, milestone }) => {
      const day = partialDateToDayNumber(milestone.date);
      // A point either falls inside the valid window or it doesn't render —
      // there's no partial-clip for a single instant in time.
      if (day === null || day < boundStart || day > boundEnd) return [];
      return [
        {
          id: milestone.id,
          day,
          title: milestone.title,
          label: milestone.shortLabel || milestone.title,
          dateLabel: formatPartialDate(milestone.date, locale),
          isHighlighted: ref.isHighlighted,
          color: ref.color,
        },
      ];
    })
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));

  const stages: CanvasStage[] = content.stages.flatMap(({ ref, stage }) => {
    const startDay = partialDateToDayNumber(stage.start);
    if (startDay === null) return [];
    const rawEnd = stage.ongoing
      ? today
      : stage.end
        ? (partialDateToDayNumber(stage.end) ?? startDay)
        : startDay;
    const endDay = Math.max(startDay, rawEnd);
    // The label always states the stage's true dates, even when the band
    // itself is clipped to fit the valid window.
    const endLabel = stage.ongoing
      ? presentLabel
      : stage.end
        ? formatPartialDate(stage.end, locale)
        : '';
    const rangeLabel = `${formatPartialDate(stage.start, locale)} → ${endLabel}`;

    // Clip the rendered band to the valid window; drop it entirely if none
    // of its span survives (e.g. it ends before the timeline's start).
    const clippedStart = Math.max(startDay, boundStart);
    const clippedEnd = Math.min(endDay, boundEnd);
    if (clippedStart > clippedEnd) return [];

    return [
      {
        id: stage.id,
        title: stage.title,
        label: stage.shortLabel || stage.title,
        startDay: clippedStart,
        endDay: clippedEnd,
        ongoing: stage.ongoing,
        isHighlighted: ref.isHighlighted,
        color: ref.color,
        rangeLabel,
      },
    ];
  });

  // "Fit" hugs the timeline's own declared range rather than always
  // stretching to `today` — a timeline that ended years ago should still fit
  // tightly to its real content, not to an arbitrary present-day ceiling.
  const declaredEnd = timeline.ongoing
    ? boundEnd
    : timeline.end
      ? (partialDateToDayNumber(timeline.end) ?? boundEnd)
      : boundEnd;

  const allDays = [
    boundStart,
    Math.min(declaredEnd, boundEnd),
    ...milestones.map((m) => m.day),
    ...stages.flatMap((s) => [s.startDay, s.endDay]),
  ];

  return {
    milestones,
    stages,
    fitStart: Math.max(boundStart, Math.min(...allDays)),
    fitEnd: Math.min(boundEnd, Math.max(...allDays)),
    boundStart,
    boundEnd,
  };
}
