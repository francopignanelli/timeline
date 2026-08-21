/**
 * The single source of truth for the app's displayed version — shown next to
 * the logo (LogoFull) and on the Terms page. Two-part, no patch number:
 * bump the second number (1.0 → 1.1) for a small change, the first (1.x →
 * 2.0) for a bigger one. There's no automated trigger for this — whoever
 * ships a user-visible change updates it here, and mirrors it in
 * docs/STATUS.md and the Terms page's "Version" line (DECISIONS #44).
 */
export const APP_VERSION = '2.2';

export const DATE_PRECISIONS = ['DAY', 'MONTH', 'QUARTER', 'YEAR', 'APPROXIMATE'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const TIME_UNITS = ['DAYS', 'MONTHS', 'QUARTERS', 'YEARS'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

export const VISIBILITIES = ['PRIVATE', 'SHARED', 'UNLISTED', 'PUBLIC'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ROLES = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

/** Roles an owner may hand out. OWNER is never granted through an invitation. */
export const GRANTABLE_ROLES = ['EDITOR', 'VIEWER'] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

/**
 * Collaboration is granted explicitly per scope (DECISIONS #35): MILESTONE or
 * STAGE grants rights on that one entity; TIMELINE grants them across the
 * timeline — its meta, its stages, and every milestone linked to it.
 *
 * Each value doubles as the DynamoDB partition prefix for that entity, so a
 * membership item lives in the same partition as the thing it grants access to.
 */
export const MEMBER_SCOPES = ['TIMELINE', 'MILESTONE', 'STAGE'] as const;
export type MemberScope = (typeof MEMBER_SCOPES)[number];

/** Scopes that can be added onto one of your own timelines after accepting. */
export const LINKABLE_SCOPES = ['MILESTONE', 'STAGE'] as const;
export type LinkableScope = (typeof LINKABLE_SCOPES)[number];

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** What a role may do. Checked as a capability, never by comparing role strings. */
export const CAPABILITIES = ['VIEW', 'EDIT', 'MANAGE'] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  OWNER: ['VIEW', 'EDIT', 'MANAGE'],
  EDITOR: ['VIEW', 'EDIT'],
  VIEWER: ['VIEW'],
};

export function roleAllows(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const CONTENT_BLOCK_TYPES = ['TEXT', 'YOUTUBE', 'IMAGE', 'FILE', 'SETLIST'] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export const UPLOAD_KINDS = ['IMAGE', 'FILE'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

/**
 * Upload allowlists are deliberately narrow (SECURITY.md + COSTS.md caps).
 * SVG is excluded on purpose: it is an executable document that can carry
 * script, and these objects are served from a domain we presign for.
 */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const FILE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
export type FileMimeType = (typeof FILE_MIME_TYPES)[number];

/**
 * Presentation colors are a fixed named palette, not free-form hex: the
 * design-token rule (CLAUDE.md) means stored data may only ever name a token,
 * never carry a raw color value. `DEFAULT` keeps the theme's own accent/muted
 * behavior. Each name resolves to a `--color-entity-*` token at render time.
 */
export const ENTITY_COLORS = [
  'DEFAULT',
  'AMBER',
  'ROSE',
  'VIOLET',
  'TEAL',
  'GREEN',
  'SLATE',
] as const;
export type EntityColor = (typeof ENTITY_COLORS)[number];

export const LIMITS = {
  TITLE_MAX: 200,
  /** Meant to stay compact on the canvas — much shorter than the full title. */
  SHORT_LABEL_MAX: 40,
  DESCRIPTION_MAX: 2000,
  BIO_MAX: 2000,
  TEXT_BLOCK_MAX: 10_000,
  /** Applies to Milestones and Stages alike — both carry the same blocks. */
  BLOCKS_MAX: 100,
  /**
   * Budget for the serialized `blocks` array. A DynamoDB item is capped at
   * 400KB and blocks are by far its largest attribute, so without this the
   * ceiling would only surface as an opaque write failure. Checked at the
   * boundary instead; the headroom covers the rest of the item.
   */
  BLOCKS_BYTES_MAX: 350_000,
  USERNAME_MIN: 3,
  USERNAME_MAX: 15,
  DISPLAY_NAME_MAX: 80,
  LOCATION_MAX: 120,
  WEBSITE_MAX: 200,
  // Upload caps (user-approved cost review, 2026-08-19). Enforced server-side
  // before a presigned URL is ever issued — the client cannot raise them.
  IMAGE_MAX_BYTES: 5 * 1024 * 1024,
  FILE_MAX_BYTES: 10 * 1024 * 1024,
  FILE_NAME_MAX: 200,
  // Collaboration + mentions
  MEMBERS_PER_RESOURCE_MAX: 50,
  MENTIONS_PER_MILESTONE_MAX: 20,
  USER_SEARCH_MIN_CHARS: 2,
  USER_SEARCH_LIMIT: 5,
  INVITATION_TTL_DAYS: 14,
  /**
   * Setlists are effectively immutable once published, so a long cache is safe
   * and keeps us far inside setlist.fm's rate limits (their rule 2 and 3).
   */
  SETLIST_CACHE_DAYS: 30,
} as const;
