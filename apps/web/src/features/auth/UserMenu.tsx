import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/ui/Avatar';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useAuth } from './auth-provider';

interface UserMenuProps {
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * The avatar is the single entry point for account actions — profile, change
 * password, and log out all live behind it, rather than logout sitting on its
 * own in the header (where it read as equal in weight to primary nav).
 */
export function UserMenu({ displayName, avatarUrl }: UserMenuProps) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={displayName}
        title={displayName}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar displayName={displayName} url={avatarUrl} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-2 w-52 rounded-lg border border-border bg-surface-elevated py-1.5 shadow-lg"
        >
          <Link
            role="menuitem"
            to="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-text transition-colors hover:bg-surface"
          >
            {t('profile.title')}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setChangingPassword(true);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-text transition-colors hover:bg-surface"
          >
            {t('auth.changePassword.title')}
          </button>
          <div className="my-1.5 border-t border-border" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-danger transition-colors hover:bg-surface"
          >
            {t('common.logout')}
          </button>
        </div>
      )}

      <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}
