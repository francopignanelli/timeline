import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ContentBlock,
  EntityColor,
  PartialDate,
  Stage,
  TimelineStageRef,
} from '@timeline/shared';
import { BlockEditor } from '../blocks/BlockEditor';
import { BlockList } from '../blocks/BlockList';
import { resolveBlocks, seedUrlDrafts } from '../blocks/block-draft';
import type { UrlDrafts } from '../blocks/block-draft';
import { useViewUrls } from '../milestones/useViewUrls';
import { Button } from '../../components/ui/Button';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Dialog } from '../../components/ui/Dialog';
import { CheckboxField, TextareaField, TextField } from '../../components/ui/fields';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { formatPartialDate } from '../../lib/format-date';
import { useUnlinkStage, useUpdateStageLink } from '../timelines/hooks';
import { useDeleteStage, useStageReferenceCount, useUpdateStage } from './hooks';

interface StagePopoverProps {
  timelineId: string;
  stage: Stage | null;
  stageRef: TimelineStageRef | null;
  onClose: () => void;
}

export function StagePopover({ timelineId, stage, stageRef, onClose }: StagePopoverProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState<PartialDate | null>(null);
  const [ongoing, setOngoing] = useState(true);
  const [end, setEnd] = useState<PartialDate | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [urls, setUrls] = useState<UrlDrafts>({});
  const [color, setColor] = useState<EntityColor>('DEFAULT');
  const [error, setError] = useState<string>();

  const unlink = useUnlinkStage(timelineId);
  const update = useUpdateStage(stage?.id ?? '');
  const updateLink = useUpdateStageLink(timelineId, stage?.id ?? '');
  const del = useDeleteStage();
  const { data: refCount } = useStageReferenceCount(confirmingDelete ? (stage?.id ?? null) : null);
  const { data: viewUrls } = useViewUrls(blocks, stage !== null);

  /*
   * Seed the form only when a *different* stage is opened. `stage` comes from
   * a React Query result, so any refetch hands back a new object with the same
   * contents — keying off identity alone would re-run this mid-edit and snap
   * every field back to the saved values (DECISIONS #38).
   */
  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!stage) {
      loadedIdRef.current = null;
      return;
    }
    if (loadedIdRef.current === stage.id) return;
    loadedIdRef.current = stage.id;

    setEditing(false);
    setConfirmingDelete(false);
    setTitle(stage.title);
    setShortLabel(stage.shortLabel ?? '');
    setDescription(stage.description ?? '');
    setStart(stage.start);
    setOngoing(stage.ongoing);
    setEnd(stage.end ?? null);
    setBlocks([...(stage.blocks ?? [])].sort((a, b) => a.order - b.order));
    setUrls(seedUrlDrafts(stage.blocks ?? []));
    setColor(stageRef?.color ?? 'DEFAULT');
    setError(undefined);
  }, [stage, stageRef]);

  if (!stage) return null;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!start) {
      setError(t('canvas.addStage.errors.startRequired'));
      return;
    }

    const resolved = resolveBlocks(blocks, urls);
    if (!resolved.ok) {
      setError(
        resolved.reason === 'YOUTUBE'
          ? t('milestone.errors.videoInvalid')
          : t('milestone.errors.setlistInvalid'),
      );
      return;
    }

    try {
      await update.mutateAsync({
        title: title.trim(),
        shortLabel: shortLabel.trim(),
        description: description.trim() || undefined,
        start,
        end: ongoing ? undefined : (end ?? undefined),
        ongoing,
        blocks: resolved.blocks,
      });
      if ((stageRef?.color ?? 'DEFAULT') !== color) {
        await updateLink.mutateAsync({ color });
      }
      setEditing(false);
    } catch {
      setError(t('common.errorGeneric'));
    }
  };

  const onUnlink = async () => {
    await unlink.mutateAsync(stage.id);
    onClose();
  };

  const onDelete = async () => {
    await del.mutateAsync(stage.id);
    onClose();
  };

  return (
    <Dialog open size="lg" onClose={onClose} title={editing ? t('stage.edit.title') : stage.title}>
      {confirmingDelete ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            {refCount !== undefined && refCount > 1
              ? t('stage.delete.warningMultiple', { count: refCount })
              : t('stage.delete.warning')}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="tertiary" onClick={() => setConfirmingDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              className="border-danger text-danger hover:bg-danger/10"
              onClick={onDelete}
              disabled={del.isPending}
            >
              {t('stage.delete.confirm')}
            </Button>
          </div>
        </div>
      ) : editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-5" noValidate>
          <TextField
            id="stage-edit-title"
            label={t('canvas.addStage.stageTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            id="stage-edit-short-label"
            label={t('common.shortLabel')}
            hint={t('common.shortLabelHint')}
            value={shortLabel}
            onChange={(e) => setShortLabel(e.target.value)}
          />
          <TextareaField
            id="stage-edit-description"
            label={t('timeline.form.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <PartialDatePicker
            idPrefix="stage-edit-start"
            label={t('timeline.form.start')}
            value={start}
            onChange={setStart}
          />
          <CheckboxField
            id="stage-edit-ongoing"
            label={t('timeline.form.ongoing')}
            checked={ongoing}
            onChange={(e) => setOngoing(e.target.checked)}
          />
          {!ongoing && (
            <PartialDatePicker
              idPrefix="stage-edit-end"
              label={t('timeline.form.end')}
              value={end}
              onChange={setEnd}
            />
          )}
          <ColorPicker label={t('common.color')} value={color} onChange={setColor} />

          <BlockEditor
            idPrefix="stage-edit"
            blocks={blocks}
            urls={urls}
            onBlocksChange={setBlocks}
            onUrlsChange={setUrls}
            onError={setError}
            viewUrls={viewUrls}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-3">
            <Button variant="tertiary" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={update.isPending || updateLink.isPending}>
              {update.isPending || updateLink.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm uppercase tracking-wide text-text-muted">
            {formatPartialDate(stage.start, i18n.language)} →{' '}
            {stage.ongoing
              ? t('common.present')
              : stage.end
                ? formatPartialDate(stage.end, i18n.language)
                : ''}
          </p>
          {stage.description && <p className="text-sm text-text-secondary">{stage.description}</p>}

          <BlockList blocks={stage.blocks ?? []} viewUrls={viewUrls} />

          <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <Button variant="tertiary" onClick={onUnlink} disabled={unlink.isPending}>
              {t('stage.unlink')}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
            <Button
              variant="tertiary"
              className="text-danger hover:text-danger"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
