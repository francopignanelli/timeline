import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyTheme, getStoredTheme } from '../lib/theme';
import type { Theme } from '../lib/theme';

/** Sun/moon toggle — mirrors LanguageSwitcher's footprint in the header. */
export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? t('common.theme.toLight') : t('common.theme.toDark')}
      aria-pressed={theme === 'dark'}
      onClick={toggle}
      className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:text-text"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {theme === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
