import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRangeCompact } from '../../lib/format-date';
import { useTimelines } from './hooks';
import { CreateTimelineDialog } from './CreateTimelineDialog';

function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 19) return 'afternoon';
  return 'evening';
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: timelines, isLoading, isError, refetch } = useTimelines();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
      <p className="font-serif text-4xl text-text">{t(`dashboard.greeting.${greetingKey()}`)}</p>

      {/* Invitations now live in the header's notifications panel, so they're
          reachable from every page rather than only the dashboard. */}
      <h2 className="mb-2 mt-14 text-sm font-medium text-text-muted">
        {t('dashboard.yourTimelines')}
      </h2>

      {isLoading && (
        <div className="flex flex-col" aria-label={t('common.loading')}>
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
          <ul>
            {timelines.map((timeline) => (
              <li key={timeline.id}>
                <Link
                  to={`/timeline/${timeline.id}`}
                  className="group flex items-baseline justify-between gap-4 border-b border-border py-5"
                >
                  <span className="font-serif text-2xl text-text transition-colors group-hover:text-accent">
                    {timeline.title}
                  </span>
                  <span className="shrink-0 font-mono text-sm text-text-muted">
                    {formatRangeCompact(
                      timeline.start,
                      timeline.end,
                      timeline.ongoing,
                      t('common.present'),
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>+ {t('dashboard.newTimeline')}</Button>
          </div>
        </>
      )}

      <CreateTimelineDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
