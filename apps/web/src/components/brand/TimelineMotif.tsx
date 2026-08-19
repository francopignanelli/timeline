interface TimelineMotifProps {
  width?: number;
  className?: string;
}

/** The dot–line–arrow graphic vocabulary, used in empty/placeholder states. */
export function TimelineMotif({ width = 280, className }: TimelineMotifProps) {
  const height = 24;
  const y = height / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <line
        x1="0"
        y1={y}
        x2={width - 16}
        y2={y}
        stroke="var(--color-timeline-line)"
        strokeWidth="1.5"
      />
      <path
        d={`M${width - 16} ${y - 6}l8 6-8 6`}
        stroke="var(--color-timeline-line)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx={width * 0.22} cy={y} r="4" fill="var(--color-accent)" />
      <circle cx={width * 0.54} cy={y} r="4" fill="var(--color-timeline-line)" />
      <circle cx={width * 0.75} cy={y} r="4" fill="var(--color-timeline-line)" />
    </svg>
  );
}
