import type { EntityColor, Timeline } from '@timeline/shared';
import type { TimelineContent } from '../../lib/timeline-content-api';
import { formatPartialDate } from '../../lib/format-date';
import { partialDateToDayNumber } from './domain/day-number';

/** Presentation-ready canvas items: domain entities flattened to day numbers. */

export interface CanvasMilestone {
  id: string;
  day: number;
  title: string;
  dateLabel: string;
  isHighlighted: boolean;
  color: EntityColor | undefined;
}

export interface CanvasStage {
  id: string;
  title: string;
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
}

export function buildCanvasItems(
  timeline: Timeline,
  content: TimelineContent,
  today: number,
  locale: string,
  presentLabel: string,
): CanvasItems {
  const milestones: CanvasMilestone[] = content.milestones
    .filter(({ ref }) => !ref.isHidden)
    .flatMap(({ ref, milestone }) => {
      const day = partialDateToDayNumber(milestone.date);
      if (day === null) return [];
      return [
        {
          id: milestone.id,
          day,
          title: milestone.title,
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
    const endLabel = stage.ongoing
      ? presentLabel
      : stage.end
        ? formatPartialDate(stage.end, locale)
        : '';
    return [
      {
        id: stage.id,
        title: stage.title,
        startDay,
        endDay: Math.max(startDay, rawEnd),
        ongoing: stage.ongoing,
        isHighlighted: ref.isHighlighted,
        color: ref.color,
        rangeLabel: `${formatPartialDate(stage.start, locale)} → ${endLabel}`,
      },
    ];
  });

  const timelineStart = partialDateToDayNumber(timeline.start) ?? today;
  const timelineEnd = timeline.ongoing
    ? today
    : timeline.end
      ? (partialDateToDayNumber(timeline.end) ?? today)
      : today;

  const allDays = [
    timelineStart,
    timelineEnd,
    ...milestones.map((m) => m.day),
    ...stages.flatMap((s) => [s.startDay, s.endDay]),
  ];

  return {
    milestones,
    stages,
    fitStart: Math.min(...allDays),
    fitEnd: Math.max(...allDays),
  };
}
