import { useTranslation } from 'react-i18next';

/** Neutral hold while a lazily-loaded route chunk arrives — no spinner flash. */
export function RouteFallback() {
  const { t } = useTranslation();
  return <div role="status" aria-label={t('common.loading')} className="flex-1 bg-bg" />;
}
