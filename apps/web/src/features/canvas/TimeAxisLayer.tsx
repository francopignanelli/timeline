import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimeScale } from './domain/time-scale';
import { dayToX } from './domain/time-scale';
import { generateTicks } from './domain/ruler';
import type { RulerTick, RulerUnit } from './domain/ruler';

interface TimeAxisLayerProps {
  scale: TimeScale;
  width: number;
  axisY: number;
  rulerVisible: boolean;
  today: number;
}

function tickLabel(
  tick: RulerTick,
  unit: RulerUnit,
  monthShort: (month: number) => string,
  quarterPrefix: string,
): string {
  switch (unit) {
    case 'YEARS':
      return String(tick.year);
    case 'QUARTERS': {
      const quarter = Math.floor((tick.month - 1) / 3) + 1;
      return tick.isPrimary ? `${quarterPrefix}${quarter} ${tick.year}` : `${quarterPrefix}${quarter}`;
    }
    case 'MONTHS':
      return tick.isPrimary ? `${monthShort(tick.month)} ${tick.year}` : monthShort(tick.month);
    case 'DAYS':
      return tick.isPrimary
        ? `${tick.dayOfMonth} ${monthShort(tick.month)}`
        : String(tick.dayOfMonth);
  }
}

export function TimeAxisLayer({ scale, width, axisY, rulerVisible, today }: TimeAxisLayerProps) {
  const { i18n } = useTranslation();

  const monthShort = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { month: 'short', timeZone: 'UTC' });
    const names = Array.from({ length: 12 }, (_, i) =>
      formatter.format(new Date(Date.UTC(2020, i, 1))),
    );
    return (month: number) => names[month - 1] ?? '';
  }, [i18n.language]);

  const spec = useMemo(
    () => (rulerVisible ? generateTicks(scale, width) : null),
    [rulerVisible, scale, width],
  );

  const quarterPrefix = i18n.language.startsWith('es') ? 'T' : 'Q';
  const todayX = dayToX(scale, today);

  return (
    <g>
      {/* Axis line with the brand's arrow at the right edge */}
      <line
        x1={0}
        y1={axisY}
        x2={width - 12}
        y2={axisY}
        stroke="var(--color-timeline-line)"
        strokeWidth={1.5}
      />
      <path
        d={`M${width - 11} ${axisY - 5} L${width - 3} ${axisY} L${width - 11} ${axisY + 5}`}
        stroke="var(--color-timeline-line)"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Now marker */}
      {todayX >= 0 && todayX <= width && (
        <line
          x1={todayX}
          y1={axisY - 9}
          x2={todayX}
          y2={axisY + 9}
          stroke="var(--color-text-muted)"
          strokeWidth={1.5}
          opacity={0.55}
        />
      )}

      {/* Ruler ticks + labels (below the axis). The first visible tick always
          carries its full label so the viewport never loses its year anchor. */}
      {spec?.ticks.map((tick, index) => {
        const x = dayToX(scale, tick.day);
        const asPrimary = index === 0 ? { ...tick, isPrimary: true } : tick;
        let label = tickLabel(asPrimary, spec.unit, monthShort, quarterPrefix);
        // DAY-level primaries show day+month; the anchor tick still needs the year.
        if (index === 0 && spec.unit === 'DAYS') label = `${label} ${tick.year}`;
        return (
          <g key={tick.day}>
            <line
              x1={x}
              y1={axisY}
              x2={x}
              y2={axisY + 6}
              stroke="var(--color-timeline-line)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={axisY + 20}
              textAnchor="middle"
              className="font-mono"
              fontSize={11}
              fill="var(--color-text-muted)"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
