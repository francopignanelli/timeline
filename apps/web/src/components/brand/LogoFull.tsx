import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@timeline/shared';
import { LogoMark } from './LogoMark';

interface LogoFullProps {
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  className?: string;
}

/**
 * Primary brand lockup: [T→] Timelines vX.Y. The wordmark is never
 * abbreviated. The version sits next to it everywhere this renders — header,
 * auth screens, the public share page — so there's one place that shows it
 * rather than a setting only the owner would think to check.
 */
export function LogoFull({ size = 28, className }: LogoFullProps) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-2 text-text ${className ?? ''}`}>
      <LogoMark size={size} className="text-accent" />
      <span className="font-sans font-medium tracking-tight" style={{ fontSize: size * 0.78 }}>
        {t('common.appName')}
      </span>
      <span
        className="font-mono text-text-muted"
        style={{ fontSize: size * 0.38 }}
      >
        v{APP_VERSION}
      </span>
    </span>
  );
}
