import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { useMyInvitations, useRespondToInvitation } from './hooks';

/**
 * Pending invitations, surfaced on the dashboard. In-app only by design
 * (DECISIONS #35): the invitee already has an account, so there is no email
 * delivery path and no SES dependency.
 */
export function InvitationsBanner() {
  const { t } = useTranslation();
  const { data: invitations } = useMyInvitations();
  const respond = useRespondToInvitation();

  if (!invitations || invitations.length === 0) return null;

  return (
    <section aria-label={t('collab.invitations')} className="mb-10 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-muted">{t('collab.invitations')}</h2>
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
        >
          <p className="min-w-0 text-sm text-text">
            {t(`collab.invitedTo.${invitation.scope}`, {
              inviter: invitation.inviterName,
              title: invitation.resourceTitle,
              role: t(`collab.roles.${invitation.role}`),
            })}
          </p>
          <span className="flex shrink-0 gap-2">
            <Button
              variant="tertiary"
              disabled={respond.isPending}
              onClick={() => void respond.mutateAsync({ id: invitation.id, accept: false })}
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
        </div>
      ))}
    </section>
  );
}
