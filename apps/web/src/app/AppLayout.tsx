import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoFull } from '../components/brand/LogoFull';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Button } from '../components/ui/Button';
import { useAuth } from '../features/auth/mock-auth';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <Link to="/dashboard" className="rounded-md">
          <LogoFull size={26} />
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {user && (
            <span
              title={user.displayName}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium text-text-secondary"
            >
              {initials(user.displayName)}
            </span>
          )}
          <Button variant="tertiary" onClick={logout}>
            {t('common.logout')}
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
