import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoFull } from '../components/brand/LogoFull';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';
import { useProfile } from '../features/profile/hooks';
import { useAvatarUrl } from '../features/profile/useAvatarUrl';
import { NotificationsButton } from '../features/sharing/NotificationsButton';
import { UserMenu } from '../features/auth/UserMenu';
import { useAuth } from '../features/auth/auth-provider';
import { RouteFallback } from './RouteFallback';

export function AppLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Also seeds the DynamoDB profile from Cognito attributes on first call
  // after login (DECISIONS #20). The profile is the editable source of
  // truth, so prefer its displayName over the Cognito one once loaded.
  const { data: profile } = useProfile();
  const displayName = profile?.displayName ?? user?.displayName ?? '';
  const { data: avatarUrl } = useAvatarUrl(profile?.avatarKey);

  return (
    <div className="flex h-screen flex-col bg-bg">
      {/*
       * The nav is absolutely centered on the header, not laid out as a grid
       * column between the logo and the actions cluster. A 3-column grid
       * only centers correctly when both flanking columns have equal
       * min-content width — logo vs. language/theme/notifications/avatar
       * never reliably match, and the mismatch becomes visible exactly when
       * nav text is long (longer Spanish labels made it obvious). Absolute
       * positioning centers the nav on the header itself, independent of
       * whatever the logo or the actions cluster measure.
       */}
      <header className="relative flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-4 md:px-10">
        <Link to="/dashboard" className="w-fit shrink-0 rounded-md">
          <LogoFull size={26} />
        </Link>

        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-4 text-sm sm:flex">
          {(
            [
              ['/dashboard', t('dashboard.yourTimelines')],
              ['/milestones', t('library.tab.milestones')],
              ['/stages', t('library.tab.stages')],
            ] as const
          ).map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap transition-colors ${
                  isActive ? 'text-text' : 'text-text-muted hover:text-text'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 md:gap-4">
          <ThemeToggle />
          <LanguageSwitcher />
          <NotificationsButton />
          {displayName && <UserMenu displayName={displayName} avatarUrl={avatarUrl} />}
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
