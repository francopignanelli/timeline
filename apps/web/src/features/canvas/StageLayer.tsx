import type { CanvasStage } from './canvas-items';
import type { TimeScale } from './domain/time-scale';
import { dayToX } from './domain/time-scale';
import { STAGE_GAP, STAGE_HEIGHT, STAGE_TOP_OFFSET } from './domain/vertical-layout';

interface StageLayerProps {
  scale: TimeScale;
  stages: CanvasStage[];
  lanes: Map<string, number>;
  axisY: number;
}

const APPROX_CHAR_PX = 7.2;

export function StageLayer({ scale, stages, lanes, axisY }: StageLayerProps) {
  return (
    <g>
      {stages.map((stage) => {
        const x = dayToX(scale, stage.startDay);
        const bandWidth = Math.max(2, (stage.endDay - stage.startDay) * scale.pxPerDay);
        const lane = lanes.get(stage.id) ?? 0;
        const y = axisY + STAGE_TOP_OFFSET + lane * (STAGE_HEIGHT + STAGE_GAP);
        const labelFits = bandWidth >= stage.title.length * APPROX_CHAR_PX + 20;
        return (
          <g key={stage.id}>
            <title>{`${stage.title} · ${stage.rangeLabel}`}</title>
            <rect
              x={x}
              y={y}
              width={bandWidth}
              height={STAGE_HEIGHT}
              rx={4}
              fill="var(--color-surface)"
              stroke={stage.isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
              strokeWidth={1}
            />
            {labelFits && (
              <text
                x={x + 10}
                y={y + STAGE_HEIGHT / 2 + 4}
                className="font-sans"
                fontSize={12}
                fill="var(--color-text-secondary)"
                pointerEvents="none"
              >
                {stage.title}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
