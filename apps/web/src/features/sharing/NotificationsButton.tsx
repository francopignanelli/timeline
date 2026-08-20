import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { useMyInvitations, useRespondToInvitation } from './hooks';

/**
 * Header notifications surface. Today it carries pending invitations (the only
 * notification the system produces); the mention data model is shaped to feed
 * the same panel once a notification consumer exists (DECISIONS #37).
 */
export function NotificationsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: invitations } = useMyInvitations();
  const respond = useRespondToInvitation();
  const count = invitations?.length ?? 0;

  // Close on outside click and on Escape — the panel is a menu, not a modal,
  // so it must not trap focus or block the page behind it.
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
        aria-haspopup="true"
        aria-label={
          count > 0
            ? t('notifications.labelWithCount', { count })
            : t('notifications.label')
        }
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:border-accent hover:text-text"
      >
        {/* Bell, drawn to match the logo's stroke weight. */}
        <svg viewBox="0 0 24 24" width={17} height={17} fill="none" aria-hidden="true">
          <path
            d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.7 18a2 2 0 0 1-3.4 0"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </svg>
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-medium leading-4 text-text-on-dark"
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface-elevated p-4 shadow-lg">
          <h2 className="mb-3 text-sm font-medium text-text-muted">{t('notifications.title')}</h2>

          {count === 0 ? (
            <p className="py-2 text-sm text-text-muted">{t('notifications.empty')}</p>
          ) : (
            <ul className="flex flex-col">
              {invitations?.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0"
                >
                  <p className="text-sm text-text">
                    {t(`collab.invitedTo.${invitation.scope}`, {
                      inviter: invitation.inviterName,
                      title: invitation.resourceTitle,
                      role: t(`collab.roles.${invitation.role}`),
                    })}
                  </p>
                  <span className="flex justify-end gap-2">
                    <Button
                      variant="tertiary"
                      disabled={respond.isPending}
                      onClick={() =>
                        void respond.mutateAsync({ id: invitation.id, accept: false })
                      }
                    >
                      {t('collab.decline')}
                    </Button>
                    <Button
                      disabled={respond.isPending}
                      onClick={() => void respond.mutateAsync({ id: invitation.id, accept: true })}
                    >
                      {t('collab.accept')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
