const STORAGE_KEY = 'timeline.theme';

export type Theme = 'light' | 'dark';

/** The default for a first-time visitor with no stored choice yet (product decision, not a system-preference fallback). */
export const DEFAULT_THEME: Theme = 'dark';

/** The user's explicit choice, or `DEFAULT_THEME` on first visit. */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw in locked-down contexts (private mode, some
    // embeds) — fall through to the default rather than crash.
  }
  return DEFAULT_THEME;
}

/**
 * Applies the theme to the document and persists the choice. Setting the
 * attribute on `<html>` (not a component-level class) is what lets every
 * token in tokens.css — already consumed everywhere via `var(--color-*)` —
 * repaint without touching a single component.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Best-effort persistence; a failed write just means it resets next visit.
  }
}
