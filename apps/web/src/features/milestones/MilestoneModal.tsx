import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ContentBlock,
  EntityColor,
  Milestone,
  PartialDate,
  TimelineMilestoneRef,
} from '@timeline/shared';
import { useViewUrls } from './useViewUrls';
import { BlockEditor } from '../blocks/BlockEditor';
import { BlockList } from '../blocks/BlockList';
import { resolveBlocks, seedUrlDrafts } from '../blocks/block-draft';
import type { UrlDrafts } from '../blocks/block-draft';
import { CollaboratorsPanel } from '../sharing/CollaboratorsPanel';
import { Button } from '../../components/ui/Button';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/fields';
import { PartialDatePicker } from '../../components/dates/PartialDatePicker';
import { formatPartialDate } from '../../lib/format-date';
import {
  useMilestoneReferenceCount,
  useUnlinkMilestone,
  useUpdateMilestoneLink,
} from '../timelines/hooks';
import { useDeleteMilestone, useUpdateMilestone } from './hooks';

interface MilestoneModalProps {
  timelineId: string;
  milestone: Milestone | null;
  milestoneRef: TimelineMilestoneRef | null;
  onClose: () => void;
}

export function MilestoneModal({
  timelineId,
  milestone,
  milestoneRef,
  onClose,
}: MilestoneModalProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<PartialDate | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  // Raw URL text per block, so a half-typed URL never destroys a stored id.
  const [urls, setUrls] = useState<UrlDrafts>({});
  const [color, setColor] = useState<EntityColor>('DEFAULT');
  const [error, setError] = useState<string>();

  const { data: referenceCount } = useMilestoneReferenceCount(milestone ? milestone.id : null);
  const unlink = useUnlinkMilestone(timelineId);
  const update = useUpdateMilestone(milestone?.id ?? '');
  const updateLink = useUpdateMilestoneLink(timelineId, milestone?.id ?? '');
  const del = useDeleteMilestone();
  // Covers both modes: `blocks` mirrors the saved blocks when not editing and
  // additionally holds freshly uploaded ones while editing, so previews work.
  const { data: viewUrls } = useViewUrls(blocks, milestone !== null);

  /*
   * Seed only when a *different* milestone is opened — see the same guard in
   * StagePopover (DECISIONS #38). Without it a background refetch re-runs this
   * and discards in-progress edits, including freshly uploaded blocks.
   */
  const loadedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!milestone) {
      loadedIdRef.current = null;
      return;
    }
    if (loadedIdRef.current !== milestone.id) {
      loadedIdRef.current = milestone.id;
      setEditing(false);
      setConfirmingDelete(false);
      setTitle(milestone.title);
      setDate(milestone.date);
      setBlocks([...milestone.blocks].sort((a, b) => a.order - b.order));
      setUrls(seedUrlDrafts(milestone.blocks));
      setColor(milestoneRef?.color ?? 'DEFAULT');
      setError(undefined);
    }
  }, [milestone, milestoneRef]);

  if (!milestone) return null;

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError(t('canvas.addMilestone.errors.dateRequired'));
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
      await update.mutateAsync({ title: title.trim(), date, blocks: resolved.blocks });
      if ((milestoneRef?.color ?? 'DEFAULT') !== color) {
        await updateLink.mutateAsync({ color });
      }
      setEditing(false);
    } catch {
      setError(t('common.errorGeneric'));
    }
  };

  const onUnlink = async () => {
    await unlink.mutateAsync(milestone.id);
    onClose();
  };

  const onDelete = async () => {
    await del.mutateAsync(milestone.id);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={editing ? t('milestone.edit.title') : milestone.title}>
      {confirmingDelete ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            {referenceCount !== undefined && referenceCount > 1
              ? t('milestone.delete.warningMultiple', { count: referenceCount })
              : t('milestone.delete.warning')}
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
              {t('milestone.delete.confirm')}
            </Button>
          </div>
        </div>
      ) : editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-5" noValidate>
          <TextField
            id="milestone-edit-title"
            label={t('canvas.addMilestone.milestoneTitle')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <PartialDatePicker
            idPrefix="milestone-edit-date"
            label={t('canvas.addMilestone.date')}
            value={date}
            onChange={setDate}
          />
          <ColorPicker label={t('common.color')} value={color} onChange={setColor} />

          <BlockEditor
            idPrefix="milestone-edit"
            blocks={blocks}
            urls={urls}
            onBlocksChange={setBlocks}
            onUrlsChange={setUrls}
            onError={setError}
            viewUrls={viewUrls}
          />

          <p className="text-xs text-text-muted">{t('milestone.edit.mentionHint')}</p>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="mt-1 flex justify-end gap-3">
            <Button variant="tertiary" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={update.isPending || updateLink.isPending}>
              {update.isPending || updateLink.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>

          {/* Milestone-scoped collaboration: rights on this milestone alone. */}
          <div className="mt-2 border-t border-border pt-5">
            <h3 className="mb-3 font-serif text-lg text-text">{t('collab.milestoneSection')}</h3>
            <CollaboratorsPanel scope="MILESTONE" resourceId={milestone.id} canManage />
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm uppercase tracking-wide text-text-muted">
            {formatPartialDate(milestone.date, i18n.language)}
          </p>

          <BlockList
            blocks={milestone.blocks}
            viewUrls={viewUrls}
            mentions={milestone.mentions}
          />

          {referenceCount !== undefined && (
            <p className="text-xs text-text-muted">
              {t('milestone.appearsIn', { count: referenceCount })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <Button variant="tertiary" onClick={onUnlink} disabled={unlink.isPending}>
              {t('milestone.unlink')}
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
