import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDate, Timeline } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { CheckboxField, TextField } from '../../components/ui/fields';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { useUpdateTimeline } from './hooks';

interface EditTimelineDialogProps {
  timeline: Timeline;
  open: boolean;
  onClose: () => void;
}

interface FieldErrors {
  title?: string;
  start?: string;
  end?: string;
  form?: string;
}

/**
 * Deliberately just title/start/ongoing/end — description, unit, and ruler
 * visibility already have their own settled defaults from creation and
 * weren't asked for here. Reachable from both the Dashboard row menu and the
 * timeline view's own header, so it takes the full `Timeline` rather than an
 * id: both call sites already have the object loaded, and re-fetching it
 * here would just be a second round-trip for data the caller already has.
 */
export function EditTimelineDialog({ timeline, open, onClose }: EditTimelineDialogProps) {
  const { t } = useTranslation();
  const update = useUpdateTimeline(timeline.id);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState<PartialDate | null>(null);
  const [ongoing, setOngoing] = useState(true);
  const [end, setEnd] = useState<PartialDate | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) {
      setTitle(timeline.title);
      setStart(timeline.start);
      setOngoing(timeline.ongoing);
      setEnd(timeline.end ?? null);
      setErrors({});
    }
  }, [open, timeline]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (title.trim().length === 0) next.title = t('timeline.form.errors.titleRequired');
    if (!start) next.start = t('timeline.form.errors.startRequired');
    if (!ongoing && !end) next.end = t('timeline.form.errors.startRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || !start) return;

    try {
      await update.mutateAsync({
        title: title.trim(),
        start,
        ongoing,
        end: ongoing ? undefined : (end ?? undefined),
      });
      onClose();
    } catch {
      // A start/end ordering conflict surfaces as a generic validation error
      // here — the same cross-field check createTimelineSchema already runs
      // catches it server-side (updateTimelineSchema alone can't, since a
      // partial patch can't see both sides without the existing record).
      setErrors({ form: t('timeline.form.errors.endInvalid') });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('timeline.edit.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          id="edit-timeline-title"
          label={t('timeline.form.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <PartialDatePicker
          idPrefix="edit-timeline-start"
          label={t('timeline.form.start')}
          value={start}
          onChange={setStart}
          error={errors.start}
        />
        <CheckboxField
          id="edit-timeline-ongoing"
          label={t('timeline.form.ongoing')}
          checked={ongoing}
          onChange={(e) => setOngoing(e.target.checked)}
        />
        {!ongoing && (
          <PartialDatePicker
            idPrefix="edit-timeline-end"
            label={t('timeline.form.end')}
            value={end}
            onChange={setEnd}
            error={errors.end}
          />
        )}
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <div className="mt-1 flex justify-end gap-3">
          <Button variant="tertiary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
