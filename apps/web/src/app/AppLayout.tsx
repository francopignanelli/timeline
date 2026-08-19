import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoFull } from '../components/brand/LogoFull';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Button } from '../components/ui/Button';
import { useAuth } from '../features/auth/auth-provider';
import { useProfile } from '../features/profile/hooks';
import { initials } from '../lib/initials';
import { RouteFallback } from './RouteFallback';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  // Also seeds the DynamoDB profile from Cognito attributes on first call
  // after login (DECISIONS #20). The profile is the editable source of
  // truth, so prefer its displayName over the Cognito one once loaded.
  const { data: profile } = useProfile();
  const displayName = profile?.displayName ?? user?.displayName ?? '';

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 px-4 py-4 md:px-10">
        <Link to="/dashboard" className="shrink-0 rounded-md">
          <LogoFull size={26} />
        </Link>
        <div className="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher />
          {displayName && (
            <Link
              to="/profile"
              aria-label={t('profile.title')}
              title={displayName}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-text-secondary transition-colors hover:border-accent hover:text-text"
            >
              {initials(displayName)}
            </Link>
          )}
          <Button variant="tertiary" className="px-2 md:px-4" onClick={() => void logout()}>
            {t('common.logout')}
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
