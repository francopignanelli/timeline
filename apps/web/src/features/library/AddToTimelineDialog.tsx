import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LinkableScope } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ApiError } from '../../lib/api-client';
import { formatRangeCompact } from '../../lib/format-date';
import { linkMilestone, linkStage } from '../../lib/timeline-content-api';
import { useTimelines } from '../timelines/hooks';
import { useInvalidateAfterInvitationChange } from '../sharing/hooks';

interface AddToTimelineDialogProps {
  scope: LinkableScope;
  /** The milestone or stage being placed. */
  resourceId: string;
  resourceTitle: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Places an item you have access to onto one of *your* timelines. Only
 * timelines you can edit are offered — the picker lists what `GET /timelines`
 * returns, and the server re-checks EDIT on the destination regardless.
 */
export function AddToTimelineDialog({
  scope,
  resourceId,
  resourceTitle,
  open,
  onClose,
}: AddToTimelineDialogProps) {
  const { t } = useTranslation();
  const { data: timelines, isLoading } = useTimelines();
  const invalidate = useInvalidateAfterInvitationChange();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setError(undefined);
      setDone(false);
    }
  }, [open]);

  const onAdd = async () => {
    if (!selectedId) {
      setError(t('library.addTo.errors.pick'));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      if (scope === 'MILESTONE') await linkMilestone(selectedId, { milestoneId: resourceId });
      else await linkStage(selectedId, { stageId: resourceId });
      invalidate();
      setDone(true);
    } catch (err) {
      // 409 is the common, benign case: it's already on that timeline.
      setError(
        err instanceof ApiError && err.status === 409
          ? t('library.addTo.errors.alreadyThere')
          : t('common.errorGeneric'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('library.addTo.title')}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          {t('library.addTo.description', { title: resourceTitle })}
        </p>

        {isLoading && <p className="text-sm text-text-muted">{t('common.loading')}</p>}

        {timelines && timelines.length === 0 && (
          <p className="text-sm text-text-muted">{t('library.addTo.noTimelines')}</p>
        )}

        {timelines && timelines.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {timelines.map((timeline) => (
              <label
                key={timeline.id}
                className={`flex cursor-pointer items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 ${
                  selectedId === timeline.id ? 'bg-accent/10' : 'hover:bg-surface'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="radio"
                    name="add-to-timeline"
                    className="accent-accent"
                    checked={selectedId === timeline.id}
                    onChange={() => setSelectedId(timeline.id)}
                  />
                  <span
                    className={`truncate ${selectedId === timeline.id ? 'font-medium text-text' : 'text-text'}`}
                  >
                    {timeline.title}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {formatRangeCompact(
                    timeline.start,
                    timeline.end,
                    timeline.ongoing,
                    t('common.present'),
                  )}
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {done && (
          <p role="status" className="text-sm text-accent">
            {t('library.addTo.added')}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-3">
          <Button variant="tertiary" onClick={onClose}>
            {done ? t('common.close') : t('common.cancel')}
          </Button>
          {!done && (
            <Button onClick={() => void onAdd()} disabled={busy || !timelines?.length}>
              {busy ? t('common.loading') : t('library.addTo.confirm')}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
