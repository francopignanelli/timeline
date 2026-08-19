interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Set when the mark appears alone; LogoFull provides its own accessible name. */
  label?: string;
}

/**
 * Timeline symbol: a horizontal timeline shaft reading as the bar of a T, with
 * a small arrowhead on the right and a matching tail chevron on the left
 * (≻────≻); the stem sits centered so the mark stays symmetric and balanced.
 * Uses currentColor so context decides between accent, text, and on-dark variants.
 */
export function LogoMark({ size = 24, className, label }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth={3.5}>
          <path d="M7.5 9H28" />
          <path d="M16 9v18" />
        </g>
        <g strokeWidth={2.5}>
          <path d="M4.5 6 7.5 9l-3 3" />
          <path d="M25 6 28 9l-3 3" />
        </g>
      </g>
    </svg>
  );
}
