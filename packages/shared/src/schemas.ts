import { z } from 'zod';
import {
  DATE_PRECISIONS,
  TIME_UNITS,
  LOCALES,
  LIMITS,
  ENTITY_COLORS,
  IMAGE_MIME_TYPES,
  FILE_MIME_TYPES,
  MEMBER_SCOPES,
  GRANTABLE_ROLES,
} from './constants';
import { isValidDateString, comparePartialDates } from './partial-date';
import { YOUTUBE_ID_RE } from './youtube';
import { SETLIST_ID_RE } from './setlist';

export const datePrecisionSchema = z.enum(DATE_PRECISIONS);

export const dateStringSchema = z
  .string()
  .refine(isValidDateString, { message: 'Expected a valid DD/MM/YYYY date' });

export const partialDateSchema = z.object({
  date: dateStringSchema,
  precision: datePrecisionSchema,
});

export const timeUnitSchema = z.enum(TIME_UNITS);
export const localeSchema = z.enum(LOCALES);

/**
 * Lowercase letters, digits, underscore and hyphen.
 *
 * Separators are allowed deliberately: tightening this to `[a-z0-9]` made
 * already-registered usernames like `franco_dev` unrepresentable, so nobody
 * could search for or invite them — the input stripped the separator and the
 * lookup missed. Any charset here must stay a superset of what existing
 * accounts already hold.
 */
export const usernameSchema = z
  .string()
  .min(LIMITS.USERNAME_MIN)
  .max(LIMITS.USERNAME_MAX)
  .regex(/^[a-z0-9_-]+$/, { message: 'Lowercase letters, digits, - and _' });

const titleSchema = z.string().trim().min(1).max(LIMITS.TITLE_MAX);

/**
 * Empty string explicitly clears a previously-set short label — the same
 * convention as `website`/`avatarKey` on the profile schema — so the field
 * can be un-set without the client having to omit the key entirely.
 */
const shortLabelSchema = z
  .union([z.literal(''), z.string().trim().min(1).max(LIMITS.SHORT_LABEL_MAX)])
  .optional();

interface TemporalRange {
  start: z.infer<typeof partialDateSchema>;
  end?: z.infer<typeof partialDateSchema> | undefined;
  ongoing: boolean;
}

function checkTemporalRange(value: TemporalRange, ctx: z.RefinementCtx): void {
  if (value.ongoing && value.end) {
    ctx.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'An ongoing range cannot also have an end date',
    });
  }
  if (value.end && comparePartialDates(value.end, value.start) < 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'End date must not be before start date',
    });
  }
}

const timelineBaseSchema = z.object({
  title: titleSchema,
  description: z.string().max(LIMITS.DESCRIPTION_MAX).optional(),
  start: partialDateSchema,
  end: partialDateSchema.optional(),
  ongoing: z.boolean(),
  unit: timeUnitSchema,
  rulerVisible: z.boolean(),
  // SHARED is derived (it means "has members"), never set directly — so the
  // user-settable set is PRIVATE | UNLISTED | PUBLIC (DECISIONS #36).
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
});

export const createTimelineSchema = timelineBaseSchema.superRefine(checkTemporalRange);

// PATCH bodies: cross-field range rules are re-checked server-side on the
// merged entity (the partial body alone cannot see both sides).
export const updateTimelineSchema = timelineBaseSchema.partial();

const textBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('TEXT'),
  order: z.number().int().min(0),
  text: z.string().max(LIMITS.TEXT_BLOCK_MAX),
});

// Only a validated video id is ever stored — the embed URL is rebuilt from it
// at render time, so no user-supplied string reaches an iframe src.
const youTubeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('YOUTUBE'),
  order: z.number().int().min(0),
  youtubeId: z.string().regex(YOUTUBE_ID_RE, { message: 'Expected a YouTube video id' }),
  caption: z.string().max(LIMITS.TITLE_MAX).optional(),
});

/** Keys are minted server-side as `u/<userId>/<ulid><ext>`; shape is pinned so a client can't smuggle a path. */
export const s3KeySchema = z
  .string()
  .max(300)
  .regex(/^u\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/, { message: 'Invalid object key' });

const uploadBlockFields = {
  id: z.string().min(1),
  order: z.number().int().min(0),
  s3Key: s3KeySchema,
  fileName: z.string().min(1).max(LIMITS.FILE_NAME_MAX),
  size: z.number().int().positive(),
};

const imageBlockSchema = z.object({
  ...uploadBlockFields,
  type: z.literal('IMAGE'),
  contentType: z.enum(IMAGE_MIME_TYPES),
  size: z.number().int().positive().max(LIMITS.IMAGE_MAX_BYTES),
  caption: z.string().max(LIMITS.TITLE_MAX).optional(),
});

const fileBlockSchema = z.object({
  ...uploadBlockFields,
  type: z.literal('FILE'),
  contentType: z.enum(FILE_MIME_TYPES),
  size: z.number().int().positive().max(LIMITS.FILE_MAX_BYTES),
});

// Only a validated id is stored; the setlist body and its attribution URL are
// fetched server-side, so no third-party content is trusted from the client.
const setlistBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('SETLIST'),
  order: z.number().int().min(0),
  setlistId: z.string().regex(SETLIST_ID_RE, { message: 'Expected a setlist.fm id' }),
  caption: z.string().max(LIMITS.TITLE_MAX).optional(),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  youTubeBlockSchema,
  imageBlockSchema,
  fileBlockSchema,
  setlistBlockSchema,
]);

/**
 * An ordered list of content blocks, shared by Milestones and Stages.
 *
 * The size guard exists because the count cap alone cannot bound the payload:
 * a handful of long text blocks can exceed DynamoDB's 400KB item limit while
 * staying well under BLOCKS_MAX. Rejecting here turns that into a clear
 * validation error rather than a write failure after the user has typed.
 */
export const blocksSchema = z
  .array(contentBlockSchema)
  .max(LIMITS.BLOCKS_MAX)
  .superRefine((blocks, ctx) => {
    const bytes = new TextEncoder().encode(JSON.stringify(blocks)).length;
    if (bytes > LIMITS.BLOCKS_BYTES_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Content is too large (${bytes} bytes, max ${LIMITS.BLOCKS_BYTES_MAX})`,
      });
    }
  });

/** Body of POST /uploads/presign — validated before any URL is issued. */
export const presignUploadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('IMAGE'),
    fileName: z.string().min(1).max(LIMITS.FILE_NAME_MAX),
    contentType: z.enum(IMAGE_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.IMAGE_MAX_BYTES),
  }),
  z.object({
    kind: z.literal('FILE'),
    fileName: z.string().min(1).max(LIMITS.FILE_NAME_MAX),
    contentType: z.enum(FILE_MIME_TYPES),
    size: z.number().int().positive().max(LIMITS.FILE_MAX_BYTES),
  }),
]);

export const viewUrlsSchema = z.object({
  keys: z.array(s3KeySchema).max(LIMITS.BLOCKS_MAX),
});

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export const memberScopeSchema = z.enum(MEMBER_SCOPES);
export const grantableRoleSchema = z.enum(GRANTABLE_ROLES);

/**
 * Invitations are addressed by **username**, never by userId: the server
 * resolves it through AP2, so a client can't invite an arbitrary subject
 * (SECURITY.md — identity is never client-supplied).
 */
export const createInvitationSchema = z.object({
  username: usernameSchema,
  role: grantableRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: grantableRoleSchema,
});

/** Share tokens are URL-safe, 22+ chars of entropy, and never user-supplied. */
export const shareTokenSchema = z
  .string()
  .min(22)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, { message: 'Invalid share token' });

export const setVisibilitySchema = z.object({
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
});

/** Public media is addressed by block id — object keys never cross the boundary. */
export const publicMediaUrlsSchema = z.object({
  blockIds: z.array(z.string().min(1).max(64)).max(LIMITS.BLOCKS_MAX),
});

export const userSearchSchema = z.object({
  // Must accept the same charset as usernameSchema, or existing accounts
  // become unsearchable.
  q: z
    .string()
    .min(LIMITS.USER_SEARCH_MIN_CHARS)
    .max(LIMITS.USERNAME_MAX)
    .regex(/^[a-z0-9_-]+$/, { message: 'Lowercase letters, digits, - and _' }),
});

const milestoneBaseSchema = z.object({
  title: titleSchema,
  shortLabel: shortLabelSchema,
  date: partialDateSchema,
  blocks: blocksSchema,
});

export const createMilestoneSchema = milestoneBaseSchema;
export const updateMilestoneSchema = milestoneBaseSchema.partial();

const stageBaseSchema = z.object({
  title: titleSchema,
  shortLabel: shortLabelSchema,
  description: z.string().max(LIMITS.DESCRIPTION_MAX).optional(),
  start: partialDateSchema,
  end: partialDateSchema.optional(),
  ongoing: z.boolean(),
  // Optional, unlike a Milestone's: Stages predate blocks, so every stage
  // already stored has none and must stay valid.
  blocks: blocksSchema.optional(),
});

export const createStageSchema = stageBaseSchema.superRefine(checkTemporalRange);
export const updateStageSchema = stageBaseSchema.partial();

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(LIMITS.DISPLAY_NAME_MAX),
  bio: z.string().max(LIMITS.BIO_MAX).optional(),
  location: z.string().max(LIMITS.LOCATION_MAX).optional(),
  // Empty string is explicitly allowed so a user can clear a previously set
  // website; JSON drops `undefined`, so omitting the key can't express "erase".
  website: z
    .union([
      z.literal(''),
      z.string().max(LIMITS.WEBSITE_MAX).regex(/^https?:\/\/\S+$/i, {
        message: 'Must be an http(s) URL',
      }),
    ])
    .optional(),
  // Empty string clears the avatar, for the same reason as `website` above.
  // Ownership of the key is checked server-side — the shape alone doesn't
  // prove the key belongs to the caller.
  avatarKey: z.union([z.literal(''), s3KeySchema]).optional(),
  locale: localeSchema,
});

export const linkMilestoneSchema = z.union([
  z.object({ milestoneId: z.string().min(1) }),
  z.object({ milestone: createMilestoneSchema }),
]);

export const linkStageSchema = z.union([
  z.object({ stageId: z.string().min(1) }),
  z.object({ stage: createStageSchema }),
]);

export const entityColorSchema = z.enum(ENTITY_COLORS);

export const updateMilestoneLinkSchema = z.object({
  displayOrder: z.number().int().min(0).optional(),
  isHighlighted: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  color: entityColorSchema.optional(),
});

export const updateStageLinkSchema = z.object({
  displayStyle: z.string().max(50).optional(),
  isHighlighted: z.boolean().optional(),
  color: entityColorSchema.optional(),
});

export type CreateTimelineInput = z.infer<typeof createTimelineSchema>;
export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type LinkMilestoneInput = z.infer<typeof linkMilestoneSchema>;
export type LinkStageInput = z.infer<typeof linkStageSchema>;
export type UpdateMilestoneLinkInput = z.infer<typeof updateMilestoneLinkSchema>;
export type UpdateStageLinkInput = z.infer<typeof updateStageLinkSchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type SetVisibilityInput = z.infer<typeof setVisibilitySchema>;
