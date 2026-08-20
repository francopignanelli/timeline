import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRangeCompact } from '../../lib/format-date';
import { TimelineCanvas } from '../canvas/TimelineCanvas';
import { MilestoneModal } from '../milestones/MilestoneModal';
import { StagePopover } from '../stages/StagePopover';
import { ShareDialog } from '../sharing/ShareDialog';
import { useTimeline, useTimelineContent } from './hooks';

export function TimelinePage() {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const { timelineId } = useParams<{ timelineId: string }>();
  const id = timelineId ?? '';
  const { data: timeline, isLoading: timelineLoading, isError: timelineError } = useTimeline(id);
  const {
    data: content,
    isLoading: contentLoading,
    isError: contentError,
    refetch: refetchContent,
  } = useTimelineContent(id);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedMilestoneId = searchParams.get('milestone');
  const selectedMilestoneEntry =
    content?.milestones.find(({ milestone }) => milestone.id === selectedMilestoneId) ?? null;

  const selectedStageId = searchParams.get('stage');
  const selectedStageEntry =
    content?.stages.find(({ stage }) => stage.id === selectedStageId) ?? null;

  const openMilestone = (milestoneId: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('stage');
    next.set('milestone', milestoneId);
    setSearchParams(next);
  };

  const closeMilestone = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('milestone');
    setSearchParams(next);
  };

  const openStage = (stageId: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('milestone');
    next.set('stage', stageId);
    setSearchParams(next);
  };

  const closeStage = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('stage');
    setSearchParams(next);
  };

  const loading = timelineLoading || contentLoading;

  if (timelineError || contentError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link to="/dashboard" className="text-sm text-text-secondary hover:text-text">
          ← {t('timeline.backToDashboard')}
        </Link>
        <div className="flex flex-col items-start gap-3 py-16">
          <p className="text-sm text-danger">{t('common.errorGeneric')}</p>
          <Button variant="secondary" onClick={() => void refetchContent()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

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
            {timeline.visibility !== 'PRIVATE' && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
                {t(`share.visibilities.${timeline.visibility}.label`)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="ml-auto text-sm text-text-secondary underline-offset-4 hover:text-text hover:underline"
            >
              {t('share.title')}
            </button>
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
            onOpenStage={openStage}
          />
        )}
      </div>

      <MilestoneModal
        timelineId={id}
        milestone={selectedMilestoneEntry?.milestone ?? null}
        milestoneRef={selectedMilestoneEntry?.ref ?? null}
        onClose={closeMilestone}
      />
      <StagePopover
        timelineId={id}
        stage={selectedStageEntry?.stage ?? null}
        stageRef={selectedStageEntry?.ref ?? null}
        onClose={closeStage}
      />
      <ShareDialog timelineId={id} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
