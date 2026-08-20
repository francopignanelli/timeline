import { LIMITS } from './constants';

/**
 * Matches an `@username` token. The username charset mirrors `usernameSchema`
 * (lowercase letters and digits). A mention must be preceded by start-of-string
 * or a non-word character so `email@handle` is never treated as a mention.
 */
const MENTION_RE = new RegExp(
  `(?:^|[^A-Za-z0-9_@])@([a-z0-9]{${LIMITS.USERNAME_MIN},${LIMITS.USERNAME_MAX}})(?![A-Za-z0-9_])`,
  'g',
);

/**
 * Extracts candidate usernames from text. Returns lowercase, de-duplicated,
 * capped — these are *candidates* only: the server must resolve each against
 * a real user (AP2) before storing anything as a mention.
 */
export function extractMentionCandidates(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    const username = match[1];
    if (username) found.add(username);
    if (found.size >= LIMITS.MENTIONS_PER_MILESTONE_MAX) break;
  }
  return [...found];
}

/** Candidates across every text-bearing block of a milestone. */
export function extractMentionsFromBlocks(blocks: readonly { type: string; text?: string }[]): string[] {
  const all = new Set<string>();
  for (const block of blocks) {
    if (typeof block.text !== 'string') continue;
    for (const username of extractMentionCandidates(block.text)) {
      all.add(username);
      if (all.size >= LIMITS.MENTIONS_PER_MILESTONE_MAX) return [...all];
    }
  }
  return [...all];
}

export interface MentionSegment {
  type: 'text' | 'mention';
  value: string;
}

/**
 * Splits text into renderable segments, marking only usernames that were
 * actually resolved server-side. An unresolved `@foo` stays plain text, so the
 * UI can never imply a user exists when they don't.
 */
export function segmentMentions(text: string, known: readonly string[]): MentionSegment[] {
  if (known.length === 0) return [{ type: 'text', value: text }];
  const knownSet = new Set(known);
  const segments: MentionSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MENTION_RE)) {
    const username = match[1];
    if (!username || !knownSet.has(username)) continue;
    // match[0] may include the boundary character before '@' — find the real '@'.
    const at = (match.index ?? 0) + match[0].indexOf('@');
    if (at > cursor) segments.push({ type: 'text', value: text.slice(cursor, at) });
    segments.push({ type: 'mention', value: username });
    cursor = at + username.length + 1;
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}
