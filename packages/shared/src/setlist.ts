/** setlist.fm ids are short lowercase hex strings, e.g. `1be1a1b8`. */
export const SETLIST_ID_RE = /^[0-9a-f]{6,12}$/;

/**
 * Extracts the setlist id from a setlist.fm URL, or accepts a bare id.
 *
 * Only the id is ever stored — never the pasted URL. The canonical page link
 * used for attribution comes back from the API with the setlist data, so it is
 * always correct even if the slug changes (mirrors how YouTube ids are handled,
 * DECISIONS #33).
 *
 * Accepts: /setlist/<artist>/<year>/<venue-slug>-<id>.html, with or without
 * scheme/www, and any host under setlist.fm.
 */
export function parseSetlistId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (SETLIST_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  // Exact host match — a lookalike like `setlist.fm.evil.example` must not pass.
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'setlist.fm' && host !== 'm.setlist.fm') return null;

  const match = /-([0-9a-f]+)\.html$/.exec(url.pathname);
  const id = match?.[1];
  return id && SETLIST_ID_RE.test(id) ? id : null;
}
