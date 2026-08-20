import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LinkableScope, PartialDate } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPartialDate, formatRangeCompact } from '../../lib/format-date';
import { useMyInvitations, useRespondToInvitation } from '../sharing/hooks';
import { useOwnMilestones, useSharedMilestones } from '../milestones/hooks';
import { useOwnStages, useSharedStages } from '../stages/hooks';
import { AddToTimelineDialog } from './AddToTimelineDialog';

interface LibraryPageProps {
  kind: LinkableScope;
}

interface Row {
  id: string;
  title: string;
  meta: string;
}

/**
 * "My milestones" / "My stages": items you own, items shared with you, and
 * invitations still awaiting an answer — kept as three separate groups so it's
 * always obvious whose item you're looking at.
 *
 * Invitation actions live here *and* in the notifications panel; both go
 * through the same mutation, so answering in one place updates the other
 * without a reload.
 */
export function LibraryPage({ kind }: LibraryPageProps) {
  const { t, i18n } = useTranslation();
  const isMilestone = kind === 'MILESTONE';

  const ownMilestones = useOwnMilestones();
  const sharedMilestones = useSharedMilestones();
  const ownStages = useOwnStages();
  const sharedStages = useSharedStages();
  const { data: invitations } = useMyInvitations();
  const respond = useRespondToInvitation();

  const [addTo, setAddTo] = useState<{ id: string; title: string } | null>(null);

  const rangeOf = (start: PartialDate, end: PartialDate | undefined, ongoing: boolean) =>
    formatRangeCompact(start, end, ongoing, t('common.present'));

  const owned: Row[] = isMilestone
    ? (ownMilestones.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        meta: formatPartialDate(m.date, i18n.language),
      }))
    : (ownStages.data ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        meta: rangeOf(s.start, s.end, s.ongoing),
      }));

  const shared: Row[] = isMilestone
    ? (sharedMilestones.data ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        meta: formatPartialDate(m.date, i18n.language),
      }))
    : (sharedStages.data ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        meta: rangeOf(s.start, s.end, s.ongoing),
      }));

  const pending = (invitations ?? []).filter((i) => i.scope === kind);
  const loading = isMilestone
    ? ownMilestones.isLoading || sharedMilestones.isLoading
    : ownStages.isLoading || sharedStages.isLoading;

  const tab = (to: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
          isActive ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text'
        }`
      }
    >
      {label}
    </NavLink>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-serif text-4xl text-text">{t('library.title')}</h1>

      <div className="mt-6 flex gap-2 border-b border-border">
        {tab('/milestones', t('library.tab.milestones'))}
        {tab('/stages', t('library.tab.stages'))}
      </div>

      {/* Invitations first: they need an answer before anything else is useful. */}
      {pending.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-sm font-medium text-text-muted">{t('library.invited')}</h2>
          {pending.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4"
            >
              <span className="min-w-0 flex-1">
                <span className="font-serif text-lg text-text">{invitation.resourceTitle}</span>
                <span className="block text-xs text-text-muted">
                  {t('library.invitedBy', {
                    inviter: invitation.inviterName,
                    role: t(`collab.roles.${invitation.role}`),
                  })}
                </span>
              </span>
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
      )}

      <Group
        heading={t('library.mine')}
        rows={owned}
        loading={loading}
        emptyText={t(`library.empty.${kind}`)}
        onAddToTimeline={(row) => setAddTo(row)}
        addLabel={t('library.addTo.action')}
      />

      <Group
        heading={t('library.sharedWithMe')}
        rows={shared}
        loading={loading}
        emptyText={t('library.noShared')}
        onAddToTimeline={(row) => setAddTo(row)}
        addLabel={t('library.addTo.action')}
      />

      {addTo && (
        <AddToTimelineDialog
          scope={kind}
          resourceId={addTo.id}
          resourceTitle={addTo.title}
          open
          onClose={() => setAddTo(null)}
        />
      )}
    </div>
  );
}

interface GroupProps {
  heading: string;
  rows: Row[];
  loading: boolean;
  emptyText: string;
  addLabel: string;
  onAddToTimeline: (row: Row) => void;
}

function Group({ heading, rows, loading, emptyText, addLabel, onAddToTimeline }: GroupProps) {
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-sm font-medium text-text-muted">{heading}</h2>

      {loading && <div className="h-16 animate-pulse rounded-lg bg-surface" />}

      {!loading && rows.length === 0 && (
        <EmptyState title={emptyText} />
      )}

      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border py-4"
        >
          <span className="min-w-0 flex-1">
            <span className="font-serif text-xl text-text">{row.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-4">
            <span className="font-mono text-sm text-text-muted">{row.meta}</span>
            <Button variant="secondary" onClick={() => onAddToTimeline(row)}>
              {addLabel}
            </Button>
          </span>
        </div>
      ))}
    </section>
  );
}
