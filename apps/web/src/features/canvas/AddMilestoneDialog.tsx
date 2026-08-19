import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartialDate } from '@timeline/shared';
import { createMilestoneSchema } from '@timeline/shared';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextareaField, TextField } from '../../components/ui/fields';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { formatPartialDate } from '../../lib/format-date';
import { useOwnMilestones } from '../milestones/hooks';
import { useLinkMilestone } from '../timelines/hooks';

interface AddMilestoneDialogProps {
  timelineId: string;
  open: boolean;
  onClose: () => void;
}

export function AddMilestoneDialog({ timelineId, open, onClose }: AddMilestoneDialogProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<PartialDate | null>(null);
  const [text, setText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const link = useLinkMilestone(timelineId);
  const existing = useOwnMilestones();

  useEffect(() => {
    if (open) {
      setTab('new');
      setTitle('');
      setDate(null);
      setText('');
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
          setError(t('canvas.addMilestone.errors.selectOne'));
          return;
        }
        await link.mutateAsync({ milestoneId: selectedId });
      } else {
        if (!date) {
          setError(t('canvas.addMilestone.errors.dateRequired'));
          return;
        }
        const parsed = createMilestoneSchema.safeParse({
          title: title.trim(),
          date,
          blocks: text.trim() ? [{ id: crypto.randomUUID(), type: 'TEXT', order: 0, text: text.trim() }] : [],
        });
        if (!parsed.success) {
          setError(t('common.errorGeneric'));
          return;
        }
        await link.mutateAsync({ milestone: parsed.data });
      }
      onClose();
    } catch {
      setError(t('common.errorGeneric'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('canvas.addMilestone.title')}>
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
            {t(`canvas.addMilestone.tab.${tabId}`)}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {tab === 'new' ? (
          <>
            <TextField
              id="add-milestone-title"
              label={t('canvas.addMilestone.milestoneTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <PartialDatePicker
              idPrefix="add-milestone-date"
              label={t('canvas.addMilestone.date')}
              value={date}
              onChange={setDate}
            />
            <TextareaField
              id="add-milestone-text"
              label={t('canvas.addMilestone.text')}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {existing.isLoading && (
              <p className="p-4 text-sm text-text-muted">{t('common.loading')}</p>
            )}
            {existing.data?.length === 0 && (
              <p className="p-4 text-sm text-text-muted">{t('canvas.addMilestone.noExisting')}</p>
            )}
            {existing.data?.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-surface"
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="existing-milestone"
                    checked={selectedId === m.id}
                    onChange={() => setSelectedId(m.id)}
                    className="accent-accent"
                  />
                  {m.title}
                </span>
                <span className="font-mono text-xs text-text-muted">
                  {formatPartialDate(m.date, i18n.language)}
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
