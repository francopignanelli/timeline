import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDate } from '@timeline/shared';
import { createStageSchema } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { CheckboxField, TextareaField, TextField } from '../../components/ui/fields';
import { Dialog } from '../../components/ui/Dialog';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { formatPartialDate } from '../../lib/format-date';
import { useOwnStages } from '../stages/hooks';
import { useLinkStage } from '../timelines/hooks';

interface AddStageDialogProps {
  timelineId: string;
  open: boolean;
  onClose: () => void;
}

export function AddStageDialog({ timelineId, open, onClose }: AddStageDialogProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [title, setTitle] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState<PartialDate | null>(null);
  const [ongoing, setOngoing] = useState(true);
  const [end, setEnd] = useState<PartialDate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const link = useLinkStage(timelineId);
  const existing = useOwnStages();

  useEffect(() => {
    if (open) {
      setTab('new');
      setTitle('');
      setShortLabel('');
      setDescription('');
      setStart(null);
      setOngoing(true);
      setEnd(null);
      setSelectedId(null);
      setError(undefined);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      if (tab === 'existing') {
        if (!selectedId) {
          setError(t('canvas.addStage.errors.selectOne'));
          return;
        }
        await link.mutateAsync({ stageId: selectedId });
      } else {
        if (!start) {
          setError(t('canvas.addStage.errors.startRequired'));
          return;
        }
        const parsed = createStageSchema.safeParse({
          title: title.trim(),
          shortLabel: shortLabel.trim(),
          description: description.trim() || undefined,
          start,
          end: ongoing ? undefined : (end ?? undefined),
          ongoing,
        });
        if (!parsed.success) {
          setError(t('common.errorGeneric'));
          return;
        }
        await link.mutateAsync({ stage: parsed.data });
      }
      onClose();
    } catch {
      setError(t('common.errorGeneric'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('canvas.addStage.title')}>
      <div className="mb-4 flex gap-2 border-b border-border">
        {(['new', 'existing'] as const).map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === tabId ? 'border-accent text-text' : 'border-transparent text-text-muted'
            }`}
          >
            {t(`canvas.addStage.tab.${tabId}`)}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {tab === 'new' ? (
          <>
            <TextField
              id="add-stage-title"
              label={t('canvas.addStage.stageTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              id="add-stage-short-label"
              label={t('common.shortLabel')}
              hint={t('common.shortLabelHint')}
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
            />
            <TextareaField
              id="add-stage-description"
              label={t('timeline.form.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <PartialDatePicker
              idPrefix="add-stage-start"
              label={t('timeline.form.start')}
              value={start}
              onChange={setStart}
            />
            <CheckboxField
              id="add-stage-ongoing"
              label={t('timeline.form.ongoing')}
              checked={ongoing}
              onChange={(e) => setOngoing(e.target.checked)}
            />
            {!ongoing && (
              <PartialDatePicker
                idPrefix="add-stage-end"
                label={t('timeline.form.end')}
                value={end}
                onChange={setEnd}
              />
            )}
          </>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {existing.isLoading && <p className="p-4 text-sm text-text-muted">{t('common.loading')}</p>}
            {existing.data?.length === 0 && (
              <p className="p-4 text-sm text-text-muted">{t('canvas.addStage.noExisting')}</p>
            )}
            {existing.data?.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm transition-colors last:border-b-0 ${
                  selectedId === s.id ? 'bg-accent/10' : 'hover:bg-surface'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="existing-stage"
                    checked={selectedId === s.id}
                    onChange={() => setSelectedId(s.id)}
                    className="accent-accent"
                  />
                  <span className={selectedId === s.id ? 'font-medium text-text' : undefined}>
                    {s.title}
                  </span>
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {formatPartialDate(s.start, i18n.language)}
                </span>
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="mt-1 flex justify-end gap-3">
          <Button variant="tertiary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={link.isPending}>
            {link.isPending ? t('common.loading') : t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
