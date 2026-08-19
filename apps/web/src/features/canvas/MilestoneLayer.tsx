import type { CanvasMilestone } from './canvas-items';
import type { PlacedMilestone } from './domain/collision-layout';
import type { VerticalLayout } from './domain/vertical-layout';
import type { TimeScale } from './domain/time-scale';
import { dayToX } from './domain/time-scale';

/** Hard cap on rendered label width (matches max-w truncation in CSS). */
export const MILESTONE_LABEL_MAX_PX = 160;

// Below-axis connectors skip this band so they never cross ruler labels.
const RULER_GAP_TOP = 7;
const RULER_GAP_BOTTOM = 27;

interface MilestoneLayerProps {
  scale: TimeScale;
  milestones: CanvasMilestone[];
  placed: Map<string, PlacedMilestone>;
  layout: VerticalLayout;
  rulerVisible: boolean;
  selectedId: string | null;
  onOpen: (milestoneId: string) => void;
}

/**
 * Milestones are DOM buttons (free focus/AT semantics, real text truncation)
 * positioned over the SVG; the connector keeps each one attached to its true
 * temporal position on the axis, whatever its level or side.
 *
 * Rendered in two passes: every connector first, every button after, so no
 * connector can paint over another milestone's label — and each label carries
 * an opaque canvas-colored background that masks anything passing behind it.
 * Milestones whose labels can't fit anywhere render as dot-only markers
 * (existence stays visible; full title in the tooltip and accessible name).
 */
export function MilestoneLayer({
  scale,
  milestones,
  placed,
  layout,
  rulerVisible,
  selectedId,
  onOpen,
}: MilestoneLayerProps) {
  const { axisY } = layout;

  const positioned = milestones.map((milestone) => {
    const placement = placed.get(milestone.id) ?? { level: 0, showLabel: true };
    return {
      milestone,
      x: dayToX(scale, milestone.day),
      dotY: layout.levelY(placement.level),
      showLabel: placement.showLabel,
    };
  });

  const connectorSegments = (dotY: number): { top: number; height: number }[] => {
    if (dotY < axisY) return [{ top: dotY, height: axisY - dotY }];
    if (!rulerVisible) return [{ top: axisY, height: dotY - axisY }];
    return [
      { top: axisY, height: RULER_GAP_TOP },
      { top: axisY + RULER_GAP_BOTTOM, height: dotY - (axisY + RULER_GAP_BOTTOM) },
    ];
  };

  return (
    <>
      {positioned.map(({ milestone, x, dotY }) =>
        connectorSegments(dotY).map((segment, index) => (
          <div
            key={`connector-${milestone.id}-${index}`}
            aria-hidden="true"
            className={
              milestone.id === selectedId ? 'absolute bg-accent' : 'absolute bg-timeline-line'
            }
            style={{ left: x - 0.75, top: segment.top, width: 1.5, height: segment.height }}
          />
        )),
      )}
      {positioned.map(({ milestone, x, dotY, showLabel }) => {
        const selected = milestone.id === selectedId;
        const emphasized = selected || milestone.isHighlighted;
        return (
          <button
            key={milestone.id}
            type="button"
            aria-label={`${milestone.title} — ${milestone.dateLabel}`}
            aria-haspopup="dialog"
            title={showLabel ? undefined : `${milestone.title} — ${milestone.dateLabel}`}
            onClick={() => onOpen(milestone.id)}
            className="group absolute flex -translate-y-1/2 items-center gap-1.5 rounded-md px-1 py-0.5"
            style={{ left: x - 11, top: dotY }}
          >
            <span
              className={`size-3.5 shrink-0 rounded-full transition-colors ${
                emphasized ? 'bg-accent' : 'bg-text-muted group-hover:bg-accent'
              }`}
            />
            {showLabel && (
              <span
                className={`truncate rounded-sm bg-bg px-1 text-sm transition-colors ${
                  selected ? 'font-medium text-accent' : 'text-text-secondary group-hover:text-text'
                }`}
                style={{ maxWidth: MILESTONE_LABEL_MAX_PX }}
              >
                {milestone.title}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
