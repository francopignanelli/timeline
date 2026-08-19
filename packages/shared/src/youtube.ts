/** A YouTube video id is exactly 11 chars of the URL-safe base64 alphabet. */
export const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the video id from the URL forms people actually paste, or from a
 * bare id. Returns null for anything else — including valid-looking URLs on
 * non-YouTube hosts, so a hostile string can never become an embed source.
 *
 * Accepted: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID,
 * youtube.com/shorts/ID, youtube.com/live/ID, with or without scheme/www,
 * and extra query params (t=, si=, list=) which are ignored.
 */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // A bare id pasted directly.
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be';
  if (!isYouTubeHost) return null;

  if (host === 'youtu.be') {
    const candidate = url.pathname.slice(1).split('/')[0] ?? '';
    return YOUTUBE_ID_RE.test(candidate) ? candidate : null;
  }

  const v = url.searchParams.get('v');
  if (v && YOUTUBE_ID_RE.test(v)) return v;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const [prefix, candidate] = segments;
    if (
      (prefix === 'embed' || prefix === 'shorts' || prefix === 'live' || prefix === 'v') &&
      candidate &&
      YOUTUBE_ID_RE.test(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

/** Privacy-preserving embed URL, always rebuilt from a validated id. */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

/** Watch URL for the "open on YouTube" affordance. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
