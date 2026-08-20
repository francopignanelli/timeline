import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LIMITS } from '@timeline/shared';
import type { SetlistData } from '@timeline/shared';
import { getSetlist } from '../../lib/setlists-api';

interface SetlistBlockViewProps {
  setlistId: string;
  caption?: string;
  /** Public pages fetch through the share-token-scoped endpoint instead. */
  fetcher?: (setlistId: string) => Promise<SetlistData>;
}

/**
 * Renders a setlist with the app's own markup (setlist.fm "Option B"), so it
 * matches surrounding article styling instead of dropping in a foreign widget.
 *
 * The attribution link is **not optional** — setlist.fm's terms require a
 * visible link back to the original page, so it renders even while the data is
 * still loading or has failed.
 */
export function SetlistBlockView({ setlistId, caption, fetcher }: SetlistBlockViewProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['setlist', setlistId],
    queryFn: () => (fetcher ?? getSetlist)(setlistId),
    // Cached hard on the server too; setlists don't change after publication.
    staleTime: LIMITS.SETLIST_CACHE_DAYS * 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const fallbackUrl = `https://www.setlist.fm/setlist/${setlistId}.html`;
  const attributionUrl = data?.url ?? fallbackUrl;

  const location = data
    ? [data.venueName, data.cityName, data.countryName].filter(Boolean).join(', ')
    : '';

  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      {isLoading && <div className="h-24 animate-pulse rounded-md bg-surface-elevated" />}

      {isError && <p className="text-sm text-text-muted">{t('setlist.unavailable')}</p>}

      {data && (
        <>
          <header className="flex flex-col gap-0.5">
            <span className="font-serif text-lg text-text">{data.artistName}</span>
            {location && <span className="text-sm text-text-secondary">{location}</span>}
            <span className="font-mono text-xs text-text-muted">
              {data.eventDate}
              {data.tourName ? ` · ${data.tourName}` : ''}
            </span>
          </header>

          {data.sets.map((set, setIndex) => (
            <div key={setIndex} className="mt-2 flex flex-col gap-1">
              {(set.name ?? set.encore) && (
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                  {set.name ?? t('setlist.encore', { count: set.encore ?? 1 })}
                </span>
              )}
              <ol className="flex flex-col gap-0.5">
                {set.songs.map((song, songIndex) => (
                  <li key={songIndex} className="flex gap-2 text-sm text-text-secondary">
                    <span className="w-5 shrink-0 text-right font-mono text-xs text-text-muted">
                      {songIndex + 1}
                    </span>
                    <span className="min-w-0">
                      {song.name}
                      {song.coverArtistName && (
                        <span className="text-text-muted">
                          {' '}
                          ({t('setlist.cover', { artist: song.coverArtistName })})
                        </span>
                      )}
                      {song.withArtistName && (
                        <span className="text-text-muted">
                          {' '}
                          ({t('setlist.with', { artist: song.withArtistName })})
                        </span>
                      )}
                      {song.info && <span className="text-text-muted"> — {song.info}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}

      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        {caption ? (
          <span className="text-xs text-text-muted">{caption}</span>
        ) : (
          <span />
        )}
        <a
          href={attributionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent underline-offset-4 hover:underline"
        >
          {t('setlist.attribution')}
        </a>
      </figcaption>
    </figure>
  );
}
