import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Timeline } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRangeCompact } from '../../lib/format-date';
import { useAuth } from '../auth/auth-provider';
import { useTimelines } from './hooks';
import { CreateTimelineDialog } from './CreateTimelineDialog';

function TimelineRow({ timeline }: { timeline: Timeline }) {
  const { t } = useTranslation();
  return (
    <li>
      <Link
        to={`/timeline/${timeline.id}`}
        className="group flex items-baseline justify-between gap-4 border-b border-border py-5"
      >
        <span className="font-serif text-2xl text-text transition-colors group-hover:text-accent">
          {timeline.title}
        </span>
        <span className="shrink-0 font-mono text-sm text-text-muted">
          {formatRangeCompact(timeline.start, timeline.end, timeline.ongoing, t('common.present'))}
        </span>
      </Link>
    </li>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: timelines, isLoading, isError, refetch } = useTimelines();
  const [createOpen, setCreateOpen] = useState(false);

  // The API returns owned and shared timelines in one list (AP3 ∪ AP12);
  // ownerId is what distinguishes them, and it's already on every row here
  // (this is the authenticated payload, not the ownerId-stripped public one).
  const mine = timelines?.filter((tl) => tl.ownerId === user?.id) ?? [];
  const shared = timelines?.filter((tl) => tl.ownerId !== user?.id) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-serif text-4xl text-text">{t('dashboard.title')}</h1>

      {isLoading && (
        <div className="mt-14 flex flex-col" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="border-b border-border py-5">
              <div className="h-7 w-1/2 animate-pulse rounded-md bg-surface" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-start gap-3 py-8">
          <p className="text-sm text-danger">{t('common.errorGeneric')}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {timelines && timelines.length === 0 && (
        <EmptyState
          title={t('dashboard.empty.title')}
          description={t('dashboard.empty.description')}
          action={<Button onClick={() => setCreateOpen(true)}>+ {t('dashboard.newTimeline')}</Button>}
        />
      )}

      {timelines && timelines.length > 0 && (
        <>
          {/* Invitations now live in the header's notifications panel, so
              they're reachable from every page rather than only the
              dashboard — this section is purely about ownership. */}
          <h2 className="mb-2 mt-14 text-sm font-medium text-text-muted">{t('dashboard.mine')}</h2>
          {mine.length > 0 ? (
            <ul>
              {mine.map((timeline) => (
                <TimelineRow key={timeline.id} timeline={timeline} />
              ))}
            </ul>
          ) : (
            <p className="border-b border-border py-5 text-sm text-text-muted">
              {t('dashboard.empty.title')}
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>+ {t('dashboard.newTimeline')}</Button>
          </div>

          {shared.length > 0 && (
            <>
              <h2 className="mb-2 mt-10 text-sm font-medium text-text-muted">
                {t('dashboard.sharedWithMe')}
              </h2>
              <ul>
                {shared.map((timeline) => (
                  <TimelineRow key={timeline.id} timeline={timeline} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <CreateTimelineDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
