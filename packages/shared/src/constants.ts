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

export const CONTENT_BLOCK_TYPES = ['TEXT'] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

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
} as const;
