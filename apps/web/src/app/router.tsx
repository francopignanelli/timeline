import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter, useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-provider';
import { AuthLayout } from '../features/auth/AuthLayout';
import { AppLayout } from './AppLayout';
import { RouteFallback } from './RouteFallback';

/**
 * Route-level code splitting: the canvas route pulls in the whole canvas
 * stack (layers, domain, dialogs) and shouldn't be in the initial bundle for
 * someone who only opens the dashboard. Auth screens split for the same
 * reason in reverse — a signed-in user never loads them.
 */
const LoginPage = lazy(() =>
  import('../features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('../features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const VerifyPage = lazy(() =>
  import('../features/auth/pages/VerifyPage').then((m) => ({ default: m.VerifyPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('../features/auth/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const DashboardPage = lazy(() =>
  import('../features/timelines/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TimelinePage = lazy(() =>
  import('../features/timelines/TimelinePage').then((m) => ({ default: m.TimelinePage })),
);
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const LibraryPage = lazy(() =>
  import('../features/library/LibraryPage').then((m) => ({ default: m.LibraryPage })),
);
const PublicTimelinePage = lazy(() =>
  import('../features/public/PublicTimelinePage').then((m) => ({ default: m.PublicTimelinePage })),
);

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-bg" />;
}

function RequireAuth() {
  const { user, isInitializing } = useAuth();
  if (isInitializing) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-mono text-sm text-text-muted">404</p>
      <p className="font-serif text-2xl text-text">{t('notFound.title')}</p>
      <Link to="/dashboard" className="text-sm text-accent hover:text-accent-hover">
        {t('notFound.back')}
      </Link>
    </div>
  );
}

/** Last-resort boundary: an unexpected render/loader crash shows a way out, not a blank page. */
function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  console.error(error);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-serif text-2xl text-text">{t('common.errorGeneric')}</p>
      <Link to="/dashboard" className="text-sm text-accent hover:text-accent-hover">
        {t('notFound.back')}
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace />, errorElement: <RouteErrorPage /> },
  {
    // Public share links. Outside every auth guard by design — a visitor with
    // the link needs no account, and the page never offers a mutation.
    path: '/p/:shareToken',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <PublicTimelinePage />
      </Suspense>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify', element: <VerifyPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/timeline/:timelineId', element: <TimelinePage /> },
      // Two routes, one component: the tab bar links between them, so each
      // view stays directly linkable.
      { path: '/milestones', element: <LibraryPage kind="MILESTONE" /> },
      { path: '/stages', element: <LibraryPage kind="STAGE" /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
