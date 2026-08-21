import { useState } from 'react';
import type { CanvasStage } from './canvas-items';
import type { TimeScale } from './domain/time-scale';
import { dayToX } from './domain/time-scale';
import { STAGE_GAP, STAGE_HEIGHT, STAGE_TOP_OFFSET } from './domain/vertical-layout';
import { entityColorVar } from '../../lib/entity-color';
import { truncateToWidth } from '../../lib/measure-text';

interface StageLayerProps {
  scale: TimeScale;
  stages: CanvasStage[];
  lanes: Map<string, number>;
  axisY: number;
  selectedId: string | null;
  onOpen: (stageId: string) => void;
}

// Must match the label's rendered font (font-sans, fontSize 12) below.
const STAGE_LABEL_FONT = '12px "Inter Variable", ui-sans-serif, system-ui, sans-serif';
const LABEL_PADDING_PX = 20;
const LABEL_MIN_WIDTH_PX = 24; // below this, a truncated label reads as noise — hide it instead

export function StageLayer({ scale, stages, lanes, axisY, selectedId, onOpen }: StageLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <g>
      {stages.map((stage) => {
        const x = dayToX(scale, stage.startDay);
        const bandWidth = Math.max(2, (stage.endDay - stage.startDay) * scale.pxPerDay);
        const lane = lanes.get(stage.id) ?? 0;
        const y = axisY + STAGE_TOP_OFFSET + lane * (STAGE_HEIGHT + STAGE_GAP);
        const availableLabelWidth = bandWidth - LABEL_PADDING_PX;
        const custom = entityColorVar(stage.color);
        const hovered = hoveredId === stage.id;
        const selected = stage.id === selectedId;
        return (
          <g
            key={stage.id}
            role="button"
            tabIndex={0}
            aria-label={`${stage.title} · ${stage.rangeLabel}`}
            onClick={() => onOpen(stage.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(stage.id);
              }
            }}
            onMouseEnter={() => setHoveredId(stage.id)}
            onMouseLeave={() => setHoveredId((h) => (h === stage.id ? null : h))}
            className="cursor-pointer focus:outline-none focus-visible:[&>rect]:stroke-accent"
          >
            {/* Native SVG tooltip: always the full title, whether or not the
                on-band text below is the short label or a truncated one. */}
            <title>{`${stage.title} · ${stage.rangeLabel}`}</title>
            <rect
              x={x}
              y={y}
              width={bandWidth}
              height={STAGE_HEIGHT}
              rx={4}
              // A tinted band stays a wash, not a slab: the color reads on the
              // border and a low-opacity fill so labels keep their contrast.
              // Selected gets the same accent stroke as hover, just a touch
              // heavier — a static width difference, not an animated pop.
              fill={custom ?? 'var(--color-surface)'}
              fillOpacity={custom ? (hovered || selected ? 0.22 : 0.14) : 1}
              stroke={
                custom ?? (stage.isHighlighted || hovered || selected ? 'var(--color-accent)' : 'var(--color-border)')
              }
              strokeWidth={selected ? 2 : hovered ? 1.5 : 1}
              className="transition-[stroke-width,fill-opacity]"
            />
            {availableLabelWidth >= LABEL_MIN_WIDTH_PX && (
              <text
                x={x + 10}
                y={y + STAGE_HEIGHT / 2 + 4}
                className={`font-sans transition-colors ${selected ? 'font-medium' : ''}`}
                fontSize={12}
                fill={custom ?? (hovered || selected ? 'var(--color-text)' : 'var(--color-text-secondary)')}
                pointerEvents="none"
              >
                {truncateToWidth(stage.label, availableLabelWidth, STAGE_LABEL_FONT)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
