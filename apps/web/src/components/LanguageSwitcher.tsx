import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@timeline/shared';

const labels: Record<Locale, string> = { en: 'EN', es: 'ES' };

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const active: Locale = i18n.language === 'es' ? 'es' : 'en';

  return (
    <div role="group" aria-label={t('common.language')} className="flex items-center gap-1">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={active === locale}
          onClick={() => void i18n.changeLanguage(locale)}
          className={`rounded-md px-2 py-1 font-mono text-xs transition-colors ${
            active === locale
              ? 'text-text underline decoration-accent decoration-2 underline-offset-4'
              : 'text-text-muted hover:text-text'
          }`}
        >
          {labels[locale]}
        </button>
      ))}
    </div>
  );
}
