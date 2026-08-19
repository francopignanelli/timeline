import { Navigate, Outlet } from 'react-router-dom';
import { LogoFull } from '../../components/brand/LogoFull';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useAuth } from './mock-auth';

export function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-bg px-6 py-12">
      <div className="absolute right-6 top-5">
        <LanguageSwitcher />
      </div>
      <LogoFull size={32} />
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
