import { Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LogoFull } from '../../components/brand/LogoFull';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { RouteFallback } from '../../app/RouteFallback';
import { useAuth } from './auth-provider';

export function AuthLayout() {
  const { user, isInitializing } = useAuth();
  // Don't bounce to the dashboard until the async session check has resolved,
  // otherwise a signed-in user briefly sees the login form on a cold load.
  if (isInitializing) return <div className="min-h-screen bg-bg" />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-bg px-6 py-12">
      <div className="absolute right-6 top-5">
        <LanguageSwitcher />
      </div>
      <LogoFull size={32} />
      <div className="w-full max-w-sm">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
