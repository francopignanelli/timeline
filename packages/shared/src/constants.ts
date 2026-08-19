export const DATE_PRECISIONS = ['DAY', 'MONTH', 'QUARTER', 'YEAR', 'APPROXIMATE'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const TIME_UNITS = ['DAYS', 'MONTHS', 'QUARTERS', 'YEARS'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

export const VISIBILITIES = ['PRIVATE', 'SHARED', 'UNLISTED', 'PUBLIC'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ROLES = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const CONTENT_BLOCK_TYPES = ['TEXT', 'YOUTUBE', 'IMAGE', 'FILE'] as const;
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
  DESCRIPTION_MAX: 2000,
  BIO_MAX: 2000,
  TEXT_BLOCK_MAX: 10_000,
  BLOCKS_PER_MILESTONE_MAX: 50,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  DISPLAY_NAME_MAX: 80,
  LOCATION_MAX: 120,
  WEBSITE_MAX: 200,
  // Upload caps (user-approved cost review, 2026-08-19). Enforced server-side
  // before a presigned URL is ever issued — the client cannot raise them.
  IMAGE_MAX_BYTES: 5 * 1024 * 1024,
  FILE_MAX_BYTES: 10 * 1024 * 1024,
  FILE_NAME_MAX: 200,
} as const;
