import { useTranslation } from 'react-i18next';
import type { ContentBlock, Mention } from '@timeline/shared';
import { youTubeEmbedUrl } from '@timeline/shared';
import { getDownloadUrls } from '../../lib/uploads-api';
import { MentionText } from '../milestones/MentionText';
import { SetlistBlockView } from '../milestones/SetlistBlockView';

interface BlockListProps {
  blocks: ContentBlock[];
  /** Presigned view URLs by object key, for image blocks. */
  viewUrls?: Record<string, string>;
  /** Resolved `@username` references, when the owning entity tracks them. */
  mentions?: Mention[];
}

/**
 * Read-only rendering of content blocks, shared by Milestones and Stages.
 *
 * Blocks are sorted by `order` rather than trusted in array order, so the
 * sequence the user arranged in the editor is what renders regardless of how
 * the API returned them.
 */
export function BlockList({ blocks, viewUrls, mentions }: BlockListProps) {
  const { t } = useTranslation();

  const openDownload = async (key: string) => {
    const urls = await getDownloadUrls([key]);
    const url = urls[key];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sorted = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <>
      {sorted.map((block) =>
        block.type === 'TEXT' ? (
          <MentionText key={block.id} text={block.text} mentions={mentions} />
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
        ) : block.type === 'SETLIST' ? (
          <SetlistBlockView key={block.id} setlistId={block.setlistId} caption={block.caption} />
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
                title={block.caption ?? t('blocks.type.YOUTUBE')}
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
    </>
  );
}
