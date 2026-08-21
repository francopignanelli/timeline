import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContentBlock, UploadKind } from '@timeline/shared';
import { LIMITS } from '@timeline/shared';
import { acceptFor, isFileMime, isImageMime, maxBytesFor, uploadFile } from '../../lib/uploads-api';
import { Button } from '../../components/ui/Button';
import { TextareaField, TextField } from '../../components/ui/fields';
import { duplicateBlock, moveBlock, moveBlockBefore, newBlock } from './block-draft';
import type { AddableBlockKind, UrlDrafts } from './block-draft';

interface BlockEditorProps {
  /** Prefixes generated field ids, so two editors can coexist on a page. */
  idPrefix: string;
  blocks: ContentBlock[];
  urls: UrlDrafts;
  onBlocksChange: (blocks: ContentBlock[]) => void;
  onUrlsChange: (urls: UrlDrafts) => void;
  onError: (message?: string) => void;
  /** Presigned preview URLs by object key, for image blocks. */
  viewUrls?: Record<string, string>;
}

/**
 * The modular content-block editor shared by Milestones and Stages: blocks can
 * be added, edited, duplicated, removed and reordered, and the order saved is
 * whatever the user arranged here.
 *
 * Reordering is offered twice on purpose. Drag-and-drop is the fast path, but
 * it is unusable by keyboard and awkward on touch, so every block also carries
 * explicit move buttons — the accessible path is a real control, not a
 * degraded fallback (Definition of Done: keyboard access).
 */
export function BlockEditor({
  idPrefix,
  blocks,
  urls,
  onBlocksChange,
  onUrlsChange,
  onError,
  viewUrls,
}: BlockEditorProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  /*
   * A row is only draggable while its grip is held. Marking the whole row
   * draggable would hijack text selection inside its textarea.
   */
  const [gripHeld, setGripHeld] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atLimit = blocks.length >= LIMITS.BLOCKS_MAX;

  const patchBlock = (id: string, patch: Partial<ContentBlock>) =>
    onBlocksChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as ContentBlock) : b)));

  const addBlock = (kind: AddableBlockKind) => {
    if (atLimit) {
      onError(t('blocks.errors.limitReached', { max: LIMITS.BLOCKS_MAX }));
      return;
    }
    onError(undefined);
    onBlocksChange([...blocks, newBlock(kind, blocks.length)]);
  };

  const removeBlock = (id: string) => {
    onBlocksChange(blocks.filter((b) => b.id !== id));
    const { [id]: _dropped, ...rest } = urls;
    onUrlsChange(rest);
  };

  const onDuplicate = (id: string) => {
    if (atLimit) {
      onError(t('blocks.errors.limitReached', { max: LIMITS.BLOCKS_MAX }));
      return;
    }
    onError(undefined);
    const next = duplicateBlock(blocks, urls, id);
    onBlocksChange(next.blocks);
    onUrlsChange(next.urls);
  };

  const move = (index: number, delta: number) =>
    onBlocksChange(moveBlock(blocks, index, index + delta));

  const endDrag = () => {
    setDraggingId(null);
    setDropTargetId(null);
    setGripHeld(false);
  };

  const onDropOn = (targetId: string) => {
    if (draggingId && draggingId !== targetId) {
      onBlocksChange(moveBlockBefore(blocks, draggingId, targetId));
    }
    endDrag();
  };

  const onPickFile = async (kind: UploadKind, file: File | undefined) => {
    if (!file) return;
    // Fail fast for a clear message; the server enforces the same allowlist and
    // size caps independently before it will sign anything.
    if (file.size > maxBytesFor(kind)) {
      onError(
        t('milestone.errors.uploadTooLarge', {
          max: Math.round(maxBytesFor(kind) / (1024 * 1024)),
        }),
      );
      return;
    }
    if (kind === 'IMAGE' ? !isImageMime(file.type) : !isFileMime(file.type)) {
      onError(t('milestone.errors.uploadType'));
      return;
    }

    onError(undefined);
    setUploading(true);
    try {
      const common = {
        id: crypto.randomUUID(),
        order: blocks.length,
        fileName: file.name,
        size: file.size,
      };
      if (kind === 'IMAGE' && isImageMime(file.type)) {
        const contentType = file.type;
        const s3Key = await uploadFile(
          { kind: 'IMAGE', fileName: file.name, contentType, size: file.size },
          file,
        );
        onBlocksChange([...blocks, { ...common, type: 'IMAGE', s3Key, contentType }]);
      } else if (kind === 'FILE' && isFileMime(file.type)) {
        const contentType = file.type;
        const s3Key = await uploadFile(
          { kind: 'FILE', fileName: file.name, contentType, size: file.size },
          file,
        );
        onBlocksChange([...blocks, { ...common, type: 'FILE', s3Key, contentType }]);
      }
    } catch {
      onError(t('milestone.errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
          {t('blocks.empty')}
        </p>
      )}

      <ul className="flex list-none flex-col gap-3 p-0">
        {blocks.map((block, i) => (
          <li
            key={block.id}
            draggable={gripHeld}
            onDragStart={() => setDraggingId(block.id)}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTargetId(block.id);
            }}
            onDragLeave={() => setDropTargetId((cur) => (cur === block.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              onDropOn(block.id);
            }}
            className={[
              'rounded-lg border bg-surface p-3 transition-colors',
              draggingId === block.id ? 'opacity-50' : '',
              dropTargetId === block.id && draggingId !== block.id ? 'border-accent' : 'border-border',
            ].join(' ')}
          >
            <div className="mb-2 flex items-center gap-1">
              <span
                aria-hidden="true"
                onPointerDown={() => setGripHeld(true)}
                onPointerUp={() => setGripHeld(false)}
                className="cursor-grab select-none px-1 text-text-muted active:cursor-grabbing"
              >
                ⠿
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t(`blocks.type.${block.type}`)}
              </span>
              <span className="font-mono text-xs text-text-muted">
                {t('blocks.position', { index: i + 1, total: blocks.length })}
              </span>

              <div className="ml-auto flex items-center gap-1">
                <BlockAction label={t('blocks.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </BlockAction>
                <BlockAction
                  label={t('blocks.moveDown')}
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </BlockAction>
                <BlockAction label={t('blocks.duplicate')} onClick={() => onDuplicate(block.id)}>
                  ⧉
                </BlockAction>
                <BlockAction label={t('blocks.remove')} danger onClick={() => removeBlock(block.id)}>
                  ✕
                </BlockAction>
              </div>
            </div>

            {block.type === 'TEXT' ? (
              <TextareaField
                id={`${idPrefix}-text-${block.id}`}
                label={t('blocks.type.TEXT')}
                value={block.text}
                onChange={(e) => patchBlock(block.id, { text: e.target.value })}
              />
            ) : block.type === 'IMAGE' ? (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-lg border border-border">
                  {viewUrls?.[block.s3Key] ? (
                    <img
                      src={viewUrls[block.s3Key]}
                      alt={block.caption ?? block.fileName}
                      className="max-h-48 w-full object-contain"
                    />
                  ) : (
                    <div className="h-24 animate-pulse bg-surface-elevated" />
                  )}
                </div>
                <TextField
                  id={`${idPrefix}-image-caption-${block.id}`}
                  label={t('blocks.caption')}
                  value={block.caption ?? ''}
                  onChange={(e) => patchBlock(block.id, { caption: e.target.value })}
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
            ) : block.type === 'SETLIST' ? (
              <TextField
                id={`${idPrefix}-setlist-${block.id}`}
                label={t('setlist.urlLabel')}
                inputMode="url"
                placeholder="https://www.setlist.fm/setlist/…"
                hint={t('setlist.urlHint')}
                value={urls[block.id] ?? ''}
                onChange={(e) => onUrlsChange({ ...urls, [block.id]: e.target.value })}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <TextField
                  id={`${idPrefix}-video-${block.id}`}
                  label={t('blocks.videoUrl')}
                  inputMode="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  hint={t('blocks.videoHint')}
                  value={urls[block.id] ?? ''}
                  onChange={(e) => onUrlsChange({ ...urls, [block.id]: e.target.value })}
                />
                <TextField
                  id={`${idPrefix}-video-caption-${block.id}`}
                  label={t('blocks.caption')}
                  value={block.caption ?? ''}
                  onChange={(e) => patchBlock(block.id, { caption: e.target.value })}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button variant="tertiary" disabled={atLimit} onClick={() => addBlock('TEXT')}>
          + {t('blocks.addText')}
        </Button>
        <Button variant="tertiary" disabled={atLimit} onClick={() => addBlock('YOUTUBE')}>
          + {t('blocks.addVideo')}
        </Button>
        <Button variant="tertiary" disabled={atLimit} onClick={() => addBlock('SETLIST')}>
          + {t('blocks.addSetlist')}
        </Button>
        <Button
          variant="tertiary"
          disabled={uploading || atLimit}
          onClick={() => imageInputRef.current?.click()}
        >
          + {t('blocks.addImage')}
        </Button>
        <Button
          variant="tertiary"
          disabled={uploading || atLimit}
          onClick={() => fileInputRef.current?.click()}
        >
          + {t('blocks.addFile')}
        </Button>
        {uploading && (
          <span aria-live="polite" className="self-center text-sm text-text-muted">
            {t('blocks.uploading')}
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
  );
}

function BlockAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        'rounded-md px-2 py-1 text-sm text-text-muted transition-colors',
        'hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'hover:text-danger' : 'hover:text-text',
      ].join(' ')}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
