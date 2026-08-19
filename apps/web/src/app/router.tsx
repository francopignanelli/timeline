import { Navigate, createBrowserRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/mock-auth';
import { AuthLayout } from '../features/auth/AuthLayout';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { VerifyPage } from '../features/auth/pages/VerifyPage';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '../features/timelines/DashboardPage';
import { TimelinePage } from '../features/timelines/TimelinePage';
import { AppLayout } from './AppLayout';

function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg">
      <p className="font-mono text-sm text-text-muted">404</p>
      <p className="font-serif text-2xl text-text">{t('notFound.title')}</p>
      <Link to="/dashboard" className="text-sm text-accent hover:text-accent-hover">
        {t('notFound.back')}
      </Link>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify', element: <VerifyPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/timeline/:timelineId', element: <TimelinePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
