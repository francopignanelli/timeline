import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { SETLIST_ID_RE } from '@timeline/shared';
import type { SetlistData, SetlistSong } from '@timeline/shared';
import * as repo from '../../repositories/setlists-repo';
import { HttpError, notFound } from '../../http-error';

const SETLIST_API_BASE = 'https://api.setlist.fm/rest/1.0';
const FETCH_TIMEOUT_MS = 8000;

const ssm = new SSMClient({});

/**
 * The API key lives in SSM Parameter Store, never in source or in a CDK
 * template — this repository is public. The Lambda receives only the parameter
 * *name* and resolves the value at runtime, cached for the life of the
 * execution environment so a warm container doesn't re-read it.
 */
let cachedApiKey: string | null = null;

async function apiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const name = process.env.SETLIST_API_KEY_PARAM;
  if (!name) {
    throw new HttpError(503, 'SETLIST_UNAVAILABLE', 'Setlist integration is not configured');
  }
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = res.Parameter?.Value;
  if (!value) {
    throw new HttpError(503, 'SETLIST_UNAVAILABLE', 'Setlist integration is not configured');
  }
  cachedApiKey = value;
  return value;
}

/** Third-party JSON: every field is treated as absent until proven otherwise. */
interface RawSetlist {
  id?: string;
  url?: string;
  eventDate?: string;
  artist?: { name?: string };
  venue?: { name?: string; city?: { name?: string; country?: { name?: string } } };
  tour?: { name?: string };
  sets?: {
    set?: {
      name?: string;
      encore?: number;
      song?: {
        name?: string;
        info?: string;
        cover?: { name?: string };
        with?: { name?: string };
      }[];
    }[];
  };
}

function normalize(id: string, raw: RawSetlist): SetlistData {
  const sets = (raw.sets?.set ?? []).map((set) => ({
    ...(set.name ? { name: set.name } : {}),
    ...(typeof set.encore === 'number' ? { encore: set.encore } : {}),
    songs: (set.song ?? [])
      .filter((song): song is { name: string } & typeof song => Boolean(song.name))
      .map((song): SetlistSong => ({
        name: song.name,
        ...(song.info ? { info: song.info } : {}),
        ...(song.cover?.name ? { coverArtistName: song.cover.name } : {}),
        ...(song.with?.name ? { withArtistName: song.with.name } : {}),
      })),
  }));

  return {
    id,
    // Falling back to a constructed URL keeps attribution present even if the
    // API omits it — the link is required, not optional (setlist.fm ToS).
    url: raw.url ?? `https://www.setlist.fm/setlist/${id}.html`,
    artistName: raw.artist?.name ?? '',
    venueName: raw.venue?.name ?? '',
    cityName: raw.venue?.city?.name ?? '',
    countryName: raw.venue?.city?.country?.name ?? '',
    ...(raw.tour?.name ? { tourName: raw.tour.name } : {}),
    eventDate: raw.eventDate ?? '',
    sets,
  };
}

/**
 * Cache-first read. Only a cache miss reaches setlist.fm, which is what keeps
 * request volume nowhere near their rate limit even with a busy timeline.
 */
export async function getSetlist(rawId: string): Promise<SetlistData> {
  if (!SETLIST_ID_RE.test(rawId)) throw notFound();

  const cached = await repo.getCachedSetlist(rawId);
  if (cached) return cached;

  const key = await apiKey();
  let res: Response;
  try {
    res = await fetch(`${SETLIST_API_BASE}/setlist/${rawId}`, {
      headers: { 'x-api-key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    // Their outage shouldn't read as our bug, and shouldn't be cached.
    throw new HttpError(502, 'SETLIST_UPSTREAM_ERROR', 'Could not reach setlist.fm');
  }

  if (res.status === 404) throw notFound();
  if (res.status === 429) {
    throw new HttpError(429, 'SETLIST_RATE_LIMITED', 'setlist.fm rate limit reached');
  }
  if (!res.ok) throw new HttpError(502, 'SETLIST_UPSTREAM_ERROR', 'Could not reach setlist.fm');

  const data = normalize(rawId, (await res.json()) as RawSetlist);
  await repo.putCachedSetlist(rawId, data);
  return data;
}
