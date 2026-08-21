import { Suspense } from 'react';
import { Navigate, Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoFull } from '../../components/brand/LogoFull';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeToggle } from '../../components/ThemeToggle';
import { RouteFallback } from '../../app/RouteFallback';
import { useAuth } from './auth-provider';

export function AuthLayout() {
  const { t } = useTranslation();
  const { user, isInitializing } = useAuth();
  // Don't bounce to the dashboard until the async session check has resolved,
  // otherwise a signed-in user briefly sees the login form on a cold load.
  if (isInitializing) return <div className="min-h-screen bg-bg" />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-bg px-6 py-12">
      <div className="absolute right-6 top-5 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <LogoFull size={32} />
      <div className="w-full max-w-sm">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <Link
        to="/terms"
        className="text-xs text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
      >
        {t('legal.termsLink')}
      </Link>
    </div>
  );
}
