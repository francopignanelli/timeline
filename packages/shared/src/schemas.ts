import { z } from 'zod';
import { DATE_PRECISIONS, TIME_UNITS, LOCALES, LIMITS } from './constants';
import { isValidDateString, comparePartialDates } from './partial-date';

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
  .regex(/^[a-z0-9_]+$/, { message: 'Lowercase letters, digits and underscores only' });

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
  // MVP accepts PRIVATE only; widened when sharing phases land.
  visibility: z.literal('PRIVATE'),
});

export const createTimelineSchema = timelineBaseSchema.superRefine(checkTemporalRange);

// PATCH bodies: cross-field range rules are re-checked server-side on the
// merged entity (the partial body alone cannot see both sides).
export const updateTimelineSchema = timelineBaseSchema.partial();

export const contentBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal('TEXT'),
  order: z.number().int().min(0),
  text: z.string().max(LIMITS.TEXT_BLOCK_MAX),
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
  website: z
    .string()
    .max(LIMITS.WEBSITE_MAX)
    .regex(/^https?:\/\/\S+$/i, { message: 'Must be an http(s) URL' })
    .optional(),
  locale: localeSchema,
});

export type CreateTimelineInput = z.infer<typeof createTimelineSchema>;
export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
