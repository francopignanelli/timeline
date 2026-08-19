import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDate, TimeUnit } from '@timeline/shared';
import { TIME_UNITS, createTimelineSchema } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { CheckboxField, SelectField, TextField, TextareaField } from '../../components/ui/fields';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { useCreateTimeline } from './hooks';

interface CreateTimelineDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FieldErrors {
  title?: string;
  start?: string;
  end?: string;
  form?: string;
}

export function CreateTimelineDialog({ open, onClose }: CreateTimelineDialogProps) {
  const { t } = useTranslation();
  const createTimeline = useCreateTimeline();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState<PartialDate | null>(null);
  const [ongoing, setOngoing] = useState(true);
  const [end, setEnd] = useState<PartialDate | null>(null);
  const [unit, setUnit] = useState<TimeUnit>('YEARS');
  const [rulerVisible, setRulerVisible] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setStart(null);
      setOngoing(true);
      setEnd(null);
      setUnit('YEARS');
      setRulerVisible(true);
      setErrors({});
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (title.trim().length === 0) next.title = t('timeline.form.errors.titleRequired');
    if (!start) next.start = t('timeline.form.errors.startRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || !start) return;

    const parsed = createTimelineSchema.safeParse({
      title: title.trim(),
      description: description.trim() || undefined,
      start,
      end: ongoing ? undefined : (end ?? undefined),
      ongoing,
      unit,
      rulerVisible,
      visibility: 'PRIVATE',
    });

    if (!parsed.success) {
      const mapped: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'title') mapped.title = t('timeline.form.errors.titleRequired');
        else if (field === 'start') mapped.start = t('timeline.form.errors.startRequired');
        else if (field === 'end') mapped.end = t('timeline.form.errors.endInvalid');
        else mapped.form = t('common.errorGeneric');
      }
      setErrors(mapped);
      return;
    }

    try {
      await createTimeline.mutateAsync(parsed.data);
      onClose();
    } catch {
      setErrors({ form: t('common.errorGeneric') });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('timeline.form.dialogTitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          id="timeline-title"
          label={t('timeline.form.title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <TextareaField
          id="timeline-description"
          label={t('timeline.form.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <PartialDatePicker
          idPrefix="timeline-start"
          label={t('timeline.form.start')}
          value={start}
          onChange={setStart}
          error={errors.start}
        />
        <CheckboxField
          id="timeline-ongoing"
          label={t('timeline.form.ongoing')}
          checked={ongoing}
          onChange={(e) => setOngoing(e.target.checked)}
        />
        {!ongoing && (
          <PartialDatePicker
            idPrefix="timeline-end"
            label={t('timeline.form.end')}
            value={end}
            onChange={setEnd}
            error={errors.end}
          />
        )}
        <SelectField
          id="timeline-unit"
          label={t('timeline.form.unit')}
          value={unit}
          onChange={(e) => setUnit(e.target.value as TimeUnit)}
        >
          {TIME_UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`timeline.units.${u}`)}
            </option>
          ))}
        </SelectField>
        <CheckboxField
          id="timeline-ruler"
          label={t('timeline.form.rulerVisible')}
          checked={rulerVisible}
          onChange={(e) => setRulerVisible(e.target.checked)}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-secondary">
            {t('timeline.form.visibility')}
          </span>
          <p className="text-sm text-text">{t('timeline.form.visibilityPrivate')}</p>
          <p className="text-xs text-text-muted">{t('timeline.form.visibilityHint')}</p>
        </div>
        {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
        <div className="mt-1 flex justify-end gap-3">
          <Button variant="tertiary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={createTimeline.isPending}>
            {createTimeline.isPending ? t('common.loading') : t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
