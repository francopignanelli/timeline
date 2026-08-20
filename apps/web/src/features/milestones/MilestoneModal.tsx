import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ContentBlock,
  EntityColor,
  Milestone,
  PartialDate,
  TimelineMilestoneRef,
  UploadKind,
} from '@timeline/shared';
import { parseYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from '@timeline/shared';
import {
  acceptFor,
  getDownloadUrls,
  isFileMime,
  isImageMime,
  maxBytesFor,
  uploadFile,
} from '../../lib/uploads-api';
import { useViewUrls } from './useViewUrls';
import { MentionText } from './MentionText';
import { CollaboratorsPanel } from '../sharing/CollaboratorsPanel';
import { Button } from '../../components/ui/Button';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Dialog } from '../../components/ui/Dialog';
import { TextareaField, TextField } from '../../components/ui/fields';
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
  // Raw per-video input, so a half-typed URL doesn't destroy the stored id.
  const [videoInputs, setVideoInputs] = useState<Record<string, string>>({});
  const [color, setColor] = useState<EntityColor>('DEFAULT');
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setBlocks(milestone.blocks);
      setVideoInputs(
        Object.fromEntries(
          milestone.blocks
            .filter((b): b is Extract<ContentBlock, { type: 'YOUTUBE' }> => b.type === 'YOUTUBE')
            .map((b) => [b.id, youTubeWatchUrl(b.youtubeId)]),
        ),
      );
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

    // Resolve every video input to a validated id before writing anything.
    const resolved: ContentBlock[] = [];
    for (const [i, block] of blocks.entries()) {
      if (block.type === 'YOUTUBE') {
        const videoId = parseYouTubeId(videoInputs[block.id] ?? '');
        if (!videoId) {
          setError(t('milestone.errors.videoInvalid'));
          return;
        }
        resolved.push({ ...block, order: i, youtubeId: videoId });
      } else {
        resolved.push({ ...block, order: i });
      }
    }

    try {
      await update.mutateAsync({ title: title.trim(), date, blocks: resolved });
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

  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));

  const addTextBlock = () =>
    setBlocks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'TEXT', order: prev.length, text: '' },
    ]);

  const addVideoBlock = () =>
    setBlocks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'YOUTUBE', order: prev.length, youtubeId: '' },
    ]);

  const onPickFile = async (kind: UploadKind, file: File | undefined) => {
    if (!file) return;
    // Fail fast on the client for a clear message; the server enforces the
    // same allowlist and size caps independently before it will sign anything.
    if (file.size > maxBytesFor(kind)) {
      setError(
        t('milestone.errors.uploadTooLarge', {
          max: Math.round(maxBytesFor(kind) / (1024 * 1024)),
        }),
      );
      return;
    }
    setError(undefined);
    setUploading(true);
    try {
      const common = { id: crypto.randomUUID(), fileName: file.name, size: file.size };
      if (kind === 'IMAGE') {
        if (!isImageMime(file.type)) {
          setError(t('milestone.errors.uploadType'));
          return;
        }
        const contentType = file.type;
        const s3Key = await uploadFile(
          { kind: 'IMAGE', fileName: file.name, contentType, size: file.size },
          file,
        );
        setBlocks((prev) => [
          ...prev,
          { ...common, type: 'IMAGE', order: prev.length, s3Key, contentType },
        ]);
      } else {
        if (!isFileMime(file.type)) {
          setError(t('milestone.errors.uploadType'));
          return;
        }
        const contentType = file.type;
        const s3Key = await uploadFile(
          { kind: 'FILE', fileName: file.name, contentType, size: file.size },
          file,
        );
        setBlocks((prev) => [
          ...prev,
          { ...common, type: 'FILE', order: prev.length, s3Key, contentType },
        ]);
      }
    } catch {
      setError(t('milestone.errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const openDownload = async (key: string) => {
    const urls = await getDownloadUrls([key]);
    const url = urls[key];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sortedBlocks = [...milestone.blocks].sort((a, b) => a.order - b.order);

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

          <div className="flex flex-col gap-4">
            {blocks.map((block, i) => (
              <div key={block.id} className="rounded-lg border border-border p-3">
                {block.type === 'TEXT' ? (
                  <TextareaField
                    id={`milestone-edit-block-${block.id}`}
                    label={`${t('canvas.addMilestone.text')} ${i + 1}`}
                    value={block.text}
                    onChange={(e) =>
                      setBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id && b.type === 'TEXT' ? { ...b, text: e.target.value } : b,
                        ),
                      )
                    }
                  />
                ) : block.type === 'IMAGE' ? (
                  <div className="flex flex-col gap-3">
                    <div className="overflow-hidden rounded-lg border border-border bg-surface">
                      {viewUrls?.[block.s3Key] ? (
                        <img
                          src={viewUrls[block.s3Key]}
                          alt={block.caption ?? block.fileName}
                          className="max-h-48 w-full object-contain"
                        />
                      ) : (
                        <div className="h-24 animate-pulse bg-surface" />
                      )}
                    </div>
                    <TextField
                      id={`milestone-edit-image-caption-${block.id}`}
                      label={t('milestone.edit.videoCaption')}
                      value={block.caption ?? ''}
                      onChange={(e) =>
                        setBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id && b.type === 'IMAGE'
                              ? { ...b, caption: e.target.value }
                              : b,
                          ),
                        )
                      }
                    />
                  </div>
                ) : block.type === 'FILE' ? (
                  <div className="flex items-center gap-2 text-sm text-text">
                    <span aria-hidden="true">📎</span>
                    <span className="truncate">{block.fileName}</span>
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {Math.max(1, Math.round(block.size / 1024))} kB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <TextField
                      id={`milestone-edit-video-${block.id}`}
                      label={t('milestone.edit.videoUrl')}
                      inputMode="url"
                      placeholder="https://www.youtube.com/watch?v=…"
                      hint={t('milestone.edit.videoHint')}
                      value={videoInputs[block.id] ?? ''}
                      onChange={(e) =>
                        setVideoInputs((prev) => ({ ...prev, [block.id]: e.target.value }))
                      }
                    />
                    <TextField
                      id={`milestone-edit-caption-${block.id}`}
                      label={t('milestone.edit.videoCaption')}
                      value={block.caption ?? ''}
                      onChange={(e) =>
                        setBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id && b.type === 'YOUTUBE'
                              ? { ...b, caption: e.target.value }
                              : b,
                          ),
                        )
                      }
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="mt-2 text-xs text-text-muted hover:text-danger"
                >
                  {t('milestone.edit.removeBlock')}
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="tertiary" onClick={addTextBlock}>
                + {t('milestone.edit.addBlock')}
              </Button>
              <Button variant="tertiary" onClick={addVideoBlock}>
                + {t('milestone.edit.addVideo')}
              </Button>
              <Button
                variant="tertiary"
                disabled={uploading}
                onClick={() => imageInputRef.current?.click()}
              >
                + {t('milestone.edit.addImage')}
              </Button>
              <Button
                variant="tertiary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                + {t('milestone.edit.addFile')}
              </Button>
              {uploading && (
                <span aria-live="polite" className="self-center text-sm text-text-muted">
                  {t('milestone.edit.uploading')}
                </span>
              )}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept={acceptFor('IMAGE')}
              className="hidden"
              onChange={(e) => {
                void onPickFile('IMAGE', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptFor('FILE')}
              className="hidden"
              onChange={(e) => {
                void onPickFile('FILE', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>

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

          {sortedBlocks.map((block) =>
            block.type === 'TEXT' ? (
              <MentionText key={block.id} text={block.text} mentions={milestone.mentions} />
            ) : block.type === 'IMAGE' ? (
              <figure key={block.id} className="flex flex-col gap-1.5">
                {viewUrls?.[block.s3Key] ? (
                  <img
                    src={viewUrls[block.s3Key]}
                    alt={block.caption ?? block.fileName}
                    className="w-full rounded-lg border border-border object-contain"
                  />
                ) : (
                  <div className="h-40 animate-pulse rounded-lg bg-surface" />
                )}
                {block.caption && (
                  <figcaption className="text-xs text-text-muted">{block.caption}</figcaption>
                )}
              </figure>
            ) : block.type === 'FILE' ? (
              <button
                key={block.id}
                type="button"
                onClick={() => void openDownload(block.s3Key)}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-accent"
              >
                <span aria-hidden="true">📎</span>
                <span className="min-w-0 flex-1 truncate text-text">{block.fileName}</span>
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {Math.max(1, Math.round(block.size / 1024))} kB
                </span>
              </button>
            ) : (
              <figure key={block.id} className="flex flex-col gap-1.5">
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
                  <iframe
                    src={youTubeEmbedUrl(block.youtubeId)}
                    title={block.caption ?? t('milestone.edit.addVideo')}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
                {block.caption && (
                  <figcaption className="text-xs text-text-muted">{block.caption}</figcaption>
                )}
              </figure>
            ),
          )}

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
