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
  /** Nothing before the timeline's start ever renders — see canvas-items.ts. */
  rangeStartDay: number;
  /** No declared end date: the timeline runs to the present. */
  ongoing: boolean;
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

export function TimeAxisLayer({
  scale,
  width,
  axisY,
  rulerVisible,
  today,
  rangeStartDay,
  ongoing,
}: TimeAxisLayerProps) {
  const { t, i18n } = useTranslation();

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
  const startX = dayToX(scale, rangeStartDay);

  /*
   * The valid window is [rangeStartDay, today] — nothing before the
   * timeline's start or after the present ever renders (product rule). The
   * axis line and ruler clip to it instead of always spanning the viewport.
   */
  const leftX = Math.max(0, startX);
  const rightX = Math.min(width - 12, todayX);
  const rangeOnScreen = leftX <= rightX;

  const startVisible = startX >= 0 && startX <= width;
  const todayVisible = todayX >= leftX && todayX <= width;

  return (
    <g>
      {rangeOnScreen && (
        <line
          x1={leftX}
          y1={axisY}
          x2={rightX}
          y2={axisY}
          stroke="var(--color-timeline-line)"
          strokeWidth={1.5}
        />
      )}

      {/* Start boundary: a quiet tick, deliberately no louder than the
          ruler's own marks — it's context, not the headline. It sits above
          the axis (the ruler's ticks live below) so the two never compete
          for the same row, and its small label never fights with Present's
          for attention the way an accent-colored flag would have. */}
      {startVisible && (
        <g>
          <line
            x1={leftX}
            y1={axisY - 6}
            x2={leftX}
            y2={axisY + 6}
            stroke="var(--color-timeline-line)"
            strokeWidth={1.5}
          />
          <text
            x={leftX + 4}
            y={axisY - 10}
            textAnchor="start"
            className="font-mono"
            fontSize={10}
            fill="var(--color-text-muted)"
          >
            {t('canvas.axisStart')}
          </text>
        </g>
      )}

      {ongoing ? (
        // No declared end date: the line ends in a red arrow with "Present"
        // set right against its tip, vertically centered on the axis itself
        // — one continuous thought ("→ Present"), not an arrow plus a
        // separately floating label above it.
        todayVisible && (
          <g>
            <path
              d={`M${todayX - 7} ${axisY - 5} L${todayX} ${axisY} L${todayX - 7} ${axisY + 5}`}
              stroke="var(--color-danger)"
              strokeWidth={1.75}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={todayX + 6}
              y={axisY}
              dominantBaseline="middle"
              textAnchor="start"
              className="font-mono"
              fontSize={11}
              fill="var(--color-text-secondary)"
            >
              {t('common.present')}
            </text>
          </g>
        )
      ) : (
        // A timeline with a real end date has nothing left to indicate at
        // "today" beyond a quiet reference tick — it doesn't continue.
        todayVisible && (
          <line
            x1={todayX}
            y1={axisY - 9}
            x2={todayX}
            y2={axisY + 9}
            stroke="var(--color-text-muted)"
            strokeWidth={1.5}
            opacity={0.55}
          />
        )
      )}

      {/* Ruler ticks + labels (below the axis), clipped to the valid window.
          The first visible tick always carries its full label so the
          viewport never loses its year anchor. */}
      {spec?.ticks
        .filter((tick) => tick.day >= rangeStartDay && tick.day <= today)
        .map((tick, index) => {
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
