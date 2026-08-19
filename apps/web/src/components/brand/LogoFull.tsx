import { LogoMark } from './LogoMark';

interface LogoFullProps {
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  className?: string;
}

/** Primary brand lockup: [T→] Timeline. The wordmark is never abbreviated. */
export function LogoFull({ size = 28, className }: LogoFullProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-text ${className ?? ''}`}>
      <LogoMark size={size} className="text-accent" />
      <span className="font-sans font-medium tracking-tight" style={{ fontSize: size * 0.78 }}>
        Timeline
      </span>
    </span>
  );
}
