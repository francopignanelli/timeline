import { useState } from 'react';
import type { CanvasMilestone } from './canvas-items';
import type { PlacedMilestone } from './domain/collision-layout';
import type { VerticalLayout } from './domain/vertical-layout';
import type { TimeScale } from './domain/time-scale';
import { dayToX } from './domain/time-scale';
import { entityColorVar } from '../../lib/entity-color';

/** Hard cap on rendered label width (matches max-w truncation in CSS). */
export const MILESTONE_LABEL_MAX_PX = 160;

// Below-axis connectors skip this band so they never cross ruler labels.
const RULER_GAP_TOP = 7;
const RULER_GAP_BOTTOM = 27;

// Invisible hit-slop around the 1.5px connector line, so hovering/clicking
// near it is realistic without widening what's actually painted.
const CONNECTOR_HIT_WIDTH = 10;

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
 *
 * Hover is tracked in one piece of state shared by the connector and the
 * button: hovering the line makes it obvious the whole marker — line, dot and
 * label alike — is one clickable thing, not just the label text.
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const clearHover = (id: string) => setHoveredId((h) => (h === id ? null : h));

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
            role="presentation"
            data-canvas-hit="true"
            onClick={() => onOpen(milestone.id)}
            onMouseEnter={() => setHoveredId(milestone.id)}
            onMouseLeave={() => clearHover(milestone.id)}
            className="absolute cursor-pointer"
            style={{
              left: x - CONNECTOR_HIT_WIDTH / 2,
              top: segment.top,
              width: CONNECTOR_HIT_WIDTH,
              height: segment.height,
            }}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 transition-colors ${
                milestone.id === selectedId
                  ? 'bg-accent'
                  : milestone.id === hoveredId
                    ? 'bg-text-secondary'
                    : 'bg-timeline-line'
              }`}
            />
          </div>
        )),
      )}
      {positioned.map(({ milestone, x, dotY, showLabel }) => {
        const selected = milestone.id === selectedId;
        const hovered = milestone.id === hoveredId;
        const custom = entityColorVar(milestone.color);
        return (
          <button
            key={milestone.id}
            type="button"
            aria-label={`${milestone.title} — ${milestone.dateLabel}`}
            aria-haspopup="dialog"
            // Always the full title, not just when the short label/degraded
            // dot hides it — a shortLabel on display is exactly the case
            // where hover needs to reveal the real name.
            title={`${milestone.title} — ${milestone.dateLabel}`}
            onClick={() => onOpen(milestone.id)}
            onMouseEnter={() => setHoveredId(milestone.id)}
            onMouseLeave={() => clearHover(milestone.id)}
            className="absolute flex -translate-y-1/2 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5"
            style={{ left: x - 11, top: dotY }}
          >
            {/*
             * The wrapper keeps a 14px layout box while the rotated inner
             * square is 10px — its 14.1px diagonal matches the old circle's
             * footprint exactly, so collision math is unaffected by the shape.
             *
             * `isHighlighted` (a curator's standing choice) still scales the
             * diamond up — that's a permanent authored state, not an
             * interaction. Selection is color-only (accent ring + connector +
             * label), on purpose: a size change on select/hover would read as
             * a pop every time you click around the canvas.
             */}
            <span className="relative flex size-3.5 shrink-0 items-center justify-center">
              <span
                className={`size-2.5 rotate-45 rounded-[2px] shadow-[0_1px_2px_rgba(20,20,19,0.18)] transition-colors ${
                  hovered ? 'brightness-110' : ''
                } ${custom ? '' : 'bg-accent'} ${milestone.isHighlighted ? 'scale-125' : ''} ${
                  selected ? 'ring-2 ring-accent/70' : ''
                }`}
                style={custom ? { backgroundColor: custom } : undefined}
              >
                {/* Shine: a soft top-left highlight fading out before center. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[2px] bg-gradient-to-br from-white/55 via-white/10 to-transparent"
                />
              </span>
            </span>
            {showLabel && (
              <span
                className={`truncate rounded-sm bg-bg px-1 text-sm transition-colors ${
                  selected ? 'font-medium text-accent' : hovered ? 'text-text' : 'text-text-secondary'
                }`}
                style={{ maxWidth: MILESTONE_LABEL_MAX_PX }}
              >
                {milestone.label}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
