import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogoFull } from '../../components/brand/LogoFull';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRangeCompact } from '../../lib/format-date';
import { getPublicContent, getPublicTimeline } from '../../lib/public-api';
import { TimelineCanvas } from '../canvas/TimelineCanvas';

/**
 * Anonymous, read-only view behind a share link. Renders the same canvas as
 * the owner sees, with every editing affordance withheld — the canvas is
 * gated by `readOnly`, not merely styled differently, so a visitor has no path
 * to a mutation even if they poke at the DOM.
 */
export function PublicTimelinePage() {
  const { t } = useTranslation();
  const { shareToken } = useParams<{ shareToken: string }>();
  const token = shareToken ?? '';

  const timeline = useQuery({
    queryKey: ['public', token],
    queryFn: () => getPublicTimeline(token),
    retry: false,
  });
  const content = useQuery({
    queryKey: ['public', token, 'content'],
    queryFn: () => getPublicContent(token),
    retry: false,
    enabled: timeline.isSuccess,
  });

  const notFound = timeline.isError;

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-10">
        <Link to="/" className="shrink-0 rounded-md">
          <LogoFull size={26} />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="text-sm text-text-secondary underline-offset-4 hover:text-text hover:underline"
          >
            {t('public.signIn')}
          </Link>
        </div>
      </header>

      {notFound ? (
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <EmptyState title={t('public.notFound.title')} description={t('public.notFound.body')} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-6 py-3">
            {timeline.data ? (
              <>
                <h1 className="font-serif text-2xl text-text">{timeline.data.title}</h1>
                <span className="font-mono text-sm text-text-muted">
                  {formatRangeCompact(
                    timeline.data.start,
                    timeline.data.end,
                    timeline.data.ongoing,
                    t('common.present'),
                  )}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                  {t('public.readOnly')}
                </span>
              </>
            ) : (
              <div
                className="h-7 w-48 animate-pulse rounded-md bg-surface"
                aria-label={t('common.loading')}
              />
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {timeline.data && content.data && (
              <TimelineCanvas
                timeline={{ ...timeline.data, ownerId: '', visibility: timeline.data.visibility }}
                content={content.data}
                selectedMilestoneId={null}
                onOpenMilestone={() => undefined}
                onOpenStage={() => undefined}
                readOnly
                publicShareToken={token}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
