import type { EntityColor } from '@timeline/shared';

/**
 * Resolves a stored palette name to its design token. `DEFAULT` returns null,
 * meaning "keep the theme's own accent/muted behavior" — callers fall back to
 * their existing classes rather than hardcoding a color.
 */
export function entityColorVar(color: EntityColor | undefined): string | null {
  if (!color || color === 'DEFAULT') return null;
  return `var(--color-entity-${color.toLowerCase()})`;
}
