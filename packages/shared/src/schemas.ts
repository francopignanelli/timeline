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

export const usernameSchema = z
  .string()
  .min(LIMITS.USERNAME_MIN)
  .max(LIMITS.USERNAME_MAX)
  .regex(/^[a-z0-9]+$/, { message: 'Lowercase letters and digits only' });

const titleSchema = z.string().trim().min(1).max(LIMITS.TITLE_MAX);

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

export const contentBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  youTubeBlockSchema,
  imageBlockSchema,
  fileBlockSchema,
]);

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
  keys: z.array(s3KeySchema).max(LIMITS.BLOCKS_PER_MILESTONE_MAX),
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
  blockIds: z.array(z.string().min(1).max(64)).max(LIMITS.BLOCKS_PER_MILESTONE_MAX),
});

export const userSearchSchema = z.object({
  q: z
    .string()
    .min(LIMITS.USER_SEARCH_MIN_CHARS)
    .max(LIMITS.USERNAME_MAX)
    .regex(/^[a-z0-9]+$/, { message: 'Lowercase letters and digits only' }),
});

const milestoneBaseSchema = z.object({
  title: titleSchema,
  date: partialDateSchema,
  blocks: z.array(contentBlockSchema).max(LIMITS.BLOCKS_PER_MILESTONE_MAX),
});

export const createMilestoneSchema = milestoneBaseSchema;
export const updateMilestoneSchema = milestoneBaseSchema.partial();

const stageBaseSchema = z.object({
  title: titleSchema,
  description: z.string().max(LIMITS.DESCRIPTION_MAX).optional(),
  start: partialDateSchema,
  end: partialDateSchema.optional(),
  ongoing: z.boolean(),
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
