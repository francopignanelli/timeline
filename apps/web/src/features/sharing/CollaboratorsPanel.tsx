import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GrantableRole, MemberScope } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/fields';
import { ApiError } from '../../lib/api-client';
import { UsernameAutocomplete } from './UsernameAutocomplete';
import {
  useInviteMember,
  useMembers,
  useRemoveMember,
  useResourceInvitations,
  useRevokeInvitation,
  useShareImpact,
  useUpdateMemberRole,
} from './hooks';

interface CollaboratorsPanelProps {
  scope: MemberScope;
  resourceId: string;
  /** Only a manager sees the invite controls; viewers still see who has access. */
  canManage: boolean;
}

export function CollaboratorsPanel({ scope, resourceId, canManage }: CollaboratorsPanelProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<GrantableRole>('EDITOR');
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const members = useMembers(scope, resourceId, true);
  const invitations = useResourceInvitations(scope, resourceId, canManage);
  const impact = useShareImpact(resourceId, canManage && scope === 'TIMELINE');
  const invite = useInviteMember(scope, resourceId);
  const revoke = useRevokeInvitation(scope, resourceId);
  const updateRole = useUpdateMemberRole(scope, resourceId);
  const remove = useRemoveMember(scope, resourceId);

  const onInvite = async () => {
    setError(undefined);
    setSentTo(null);
    if (username.length < 3) {
      setError(t('collab.errors.usernameTooShort'));
      return;
    }
    try {
      await invite.mutateAsync({ username, role });
      // Confirm explicitly: the invitation is in-app, so without this the
      // sender has no signal that anything happened.
      setSentTo(username);
      setUsername('');
    } catch (err) {
      // 404 here means "no such user" — the only case worth distinguishing.
      setError(
        err instanceof ApiError && err.status === 404
          ? t('collab.errors.userNotFound')
          : err instanceof ApiError && err.status === 409
            ? t('collab.errors.alreadyInvited')
            : t('common.errorGeneric'),
      );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/*
        Deliberately NOT a <form>. This panel is mounted inside the milestone
        editor's form, and nested forms are invalid HTML — the browser gave the
        Invite button to the *outer* form, so clicking it saved the milestone
        and never sent the invite. A plain button keeps the panel safe to embed
        anywhere.
      */}
      {canManage && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <UsernameAutocomplete
                id={`invite-username-${scope}`}
                label={t('collab.inviteLabel')}
                value={username}
                onChange={setUsername}
                onSubmit={() => void onInvite()}
              />
            </div>
            <div className="w-40">
              <SelectField
                id={`invite-role-${scope}`}
                label={t('collab.role')}
                value={role}
                onChange={(e) => setRole(e.target.value as GrantableRole)}
              >
                <option value="EDITOR">{t('collab.roles.EDITOR')}</option>
                <option value="VIEWER">{t('collab.roles.VIEWER')}</option>
              </SelectField>
            </div>
            <Button type="button" onClick={() => void onInvite()} disabled={invite.isPending}>
              {invite.isPending ? t('common.loading') : t('collab.invite')}
            </Button>
          </div>

          {/*
            The scope of the grant is stated before it is made — and for a
            timeline-scoped invite, how far it reaches beyond this timeline
            (DECISIONS #35).
          */}
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-xs text-text-secondary">
            <p className="font-medium text-text">{t(`collab.scopeWarning.${scope}.title`)}</p>
            <p className="mt-1">{t(`collab.scopeWarning.${scope}.body`)}</p>
            {scope === 'TIMELINE' && impact.data && impact.data.sharedMilestoneCount > 0 && (
              <p className="mt-1.5 text-danger">
                {t('collab.scopeWarning.TIMELINE.sharedMilestones', {
                  count: impact.data.sharedMilestoneCount,
                })}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {sentTo && (
            <p role="status" className="text-sm text-accent">
              {t('collab.inviteSent', { username: sentTo })}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col">
        <h3 className="mb-2 text-sm font-medium text-text-muted">{t('collab.whoHasAccess')}</h3>

        {members.isLoading && <p className="text-sm text-text-muted">{t('common.loading')}</p>}
        {members.data?.length === 0 && (
          <p className="text-sm text-text-muted">{t('collab.noCollaborators')}</p>
        )}

        {members.data?.map((member) => (
          <div
            key={member.userId}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="text-sm text-text">{member.displayName}</span>{' '}
              <span className="font-mono text-xs text-text-muted">@{member.username}</span>
            </span>
            {canManage ? (
              <span className="flex items-center gap-2">
                <select
                  aria-label={t('collab.role')}
                  value={member.role === 'OWNER' ? 'EDITOR' : member.role}
                  disabled={member.role === 'OWNER' || updateRole.isPending}
                  onChange={(e) =>
                    void updateRole.mutateAsync({
                      userId: member.userId,
                      role: e.target.value as GrantableRole,
                    })
                  }
                  className="h-8 rounded-md border border-border bg-surface-elevated px-2 text-xs text-text"
                >
                  <option value="EDITOR">{t('collab.roles.EDITOR')}</option>
                  <option value="VIEWER">{t('collab.roles.VIEWER')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(member.userId)}
                  className="text-xs text-text-muted hover:text-danger"
                >
                  {t('collab.remove')}
                </button>
              </span>
            ) : (
              <span className="text-xs text-text-muted">{t(`collab.roles.${member.role}`)}</span>
            )}
          </div>
        ))}
      </div>

      {canManage && invitations.data && invitations.data.length > 0 && (
        <div className="flex flex-col">
          <h3 className="mb-2 text-sm font-medium text-text-muted">{t('collab.pending')}</h3>
          {invitations.data.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-sm text-text">
                  @{invitation.inviteeUsername}
                </span>
                <span className="text-xs text-text-muted">
                  {t('collab.awaitingReply', { role: t(`collab.roles.${invitation.role}`) })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void revoke.mutateAsync(invitation.id)}
                className="text-xs text-text-muted hover:text-danger"
              >
                {t('collab.revoke')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
