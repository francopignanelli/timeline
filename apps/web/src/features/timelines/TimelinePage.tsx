import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRangeCompact } from '../../lib/format-date';
import { TimelineCanvas } from '../canvas/TimelineCanvas';
import { MilestoneModal } from '../milestones/MilestoneModal';
import { useTimeline, useTimelineContent } from './hooks';

export function TimelinePage() {
  const { t } = useTranslation();
  const { timelineId } = useParams<{ timelineId: string }>();
  const id = timelineId ?? '';
  const { data: timeline, isLoading: timelineLoading } = useTimeline(id);
  const { data: content, isLoading: contentLoading } = useTimelineContent(id);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedMilestoneId = searchParams.get('milestone');
  const selectedMilestone =
    content?.milestones.find(({ milestone }) => milestone.id === selectedMilestoneId)?.milestone ??
    null;

  const openMilestone = (milestoneId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('milestone', milestoneId);
    setSearchParams(next);
  };

  const closeMilestone = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('milestone');
    setSearchParams(next);
  };

  const loading = timelineLoading || contentLoading;

  if (!loading && !timeline) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text">
          ← {t('timeline.backToDashboard')}
        </Link>
        <EmptyState title={t('timeline.notFound')} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border px-6 py-3">
        <Link
          to="/dashboard"
          aria-label={t('timeline.backToDashboard')}
          className="text-sm text-text-secondary hover:text-text"
        >
          ←
        </Link>
        {timeline ? (
          <>
            <h1 className="font-serif text-2xl text-text">{timeline.title}</h1>
            <span className="font-mono text-sm text-text-muted">
              {formatRangeCompact(timeline.start, timeline.end, timeline.ongoing, t('common.present'))}
            </span>
          </>
        ) : (
          <div className="h-7 w-48 animate-pulse rounded-md bg-surface" aria-label={t('common.loading')} />
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {timeline && content && (
          <TimelineCanvas
            timeline={timeline}
            content={content}
            selectedMilestoneId={selectedMilestoneId}
            onOpenMilestone={openMilestone}
          />
        )}
      </div>

      <MilestoneModal milestone={selectedMilestone} onClose={closeMilestone} />
    </div>
  );
}
