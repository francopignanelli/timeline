import { describe, it, expect } from 'vitest';
import {
  partialDateSchema,
  createTimelineSchema,
  createMilestoneSchema,
  createStageSchema,
  updateProfileSchema,
  usernameSchema,
  contentBlockSchema,
} from './schemas';
import { LIMITS } from './constants';

const validStart = { date: '01/03/2020', precision: 'MONTH' } as const;
const validEnd = { date: '01/03/2026', precision: 'MONTH' } as const;

const validTimeline = {
  title: 'My Concerts',
  start: validStart,
  ongoing: true,
  unit: 'YEARS',
  rulerVisible: true,
  visibility: 'PRIVATE',
} as const;

describe('partialDateSchema', () => {
  it('accepts valid DD/MM/YYYY dates', () => {
    expect(partialDateSchema.safeParse({ date: '28/10/2022', precision: 'DAY' }).success).toBe(
      true,
    );
  });

  it('rejects ISO format and impossible dates', () => {
    expect(partialDateSchema.safeParse({ date: '2022-10-28', precision: 'DAY' }).success).toBe(
      false,
    );
    expect(partialDateSchema.safeParse({ date: '31/02/2022', precision: 'DAY' }).success).toBe(
      false,
    );
  });

  it('rejects unknown precision', () => {
    expect(partialDateSchema.safeParse({ date: '28/10/2022', precision: 'DECADE' }).success).toBe(
      false,
    );
  });
});

describe('createTimelineSchema', () => {
  it('accepts a valid ongoing timeline', () => {
    expect(createTimelineSchema.safeParse(validTimeline).success).toBe(true);
  });

  it('accepts a bounded timeline', () => {
    const result = createTimelineSchema.safeParse({
      ...validTimeline,
      ongoing: false,
      end: validEnd,
    });
    expect(result.success).toBe(true);
  });

  it('rejects ongoing with an end date', () => {
    const result = createTimelineSchema.safeParse({ ...validTimeline, end: validEnd });
    expect(result.success).toBe(false);
  });

  it('rejects end before start', () => {
    const result = createTimelineSchema.safeParse({
      ...validTimeline,
      ongoing: false,
      end: { date: '01/01/2019', precision: 'YEAR' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts the user-settable visibilities but not the derived one', () => {
    for (const visibility of ['PRIVATE', 'UNLISTED', 'PUBLIC'] as const) {
      expect(createTimelineSchema.safeParse({ ...validTimeline, visibility }).success).toBe(true);
    }
    // SHARED means "has members" — it is derived, never set directly.
    expect(createTimelineSchema.safeParse({ ...validTimeline, visibility: 'SHARED' }).success).toBe(
      false,
    );
  });

  it('rejects empty and oversized titles', () => {
    expect(createTimelineSchema.safeParse({ ...validTimeline, title: '  ' }).success).toBe(false);
    expect(
      createTimelineSchema.safeParse({ ...validTimeline, title: 'x'.repeat(LIMITS.TITLE_MAX + 1) })
        .success,
    ).toBe(false);
  });
});

describe('createMilestoneSchema', () => {
  const validMilestone = {
    title: 'Coldplay — River Plate',
    date: { date: '28/10/2022', precision: 'DAY' },
    blocks: [{ id: 'b1', type: 'TEXT', order: 0, text: 'Our first Coldplay concert.' }],
  } as const;

  it('accepts a valid milestone', () => {
    expect(createMilestoneSchema.safeParse(validMilestone).success).toBe(true);
  });

  it('caps the number of blocks', () => {
    const blocks = Array.from({ length: LIMITS.BLOCKS_PER_MILESTONE_MAX + 1 }, (_, i) => ({
      id: `b${i}`,
      type: 'TEXT' as const,
      order: i,
      text: 'x',
    }));
    expect(createMilestoneSchema.safeParse({ ...validMilestone, blocks }).success).toBe(false);
  });

  it('rejects non-TEXT blocks in MVP', () => {
    expect(
      contentBlockSchema.safeParse({ id: 'b1', type: 'IMAGE', order: 0, text: '' }).success,
    ).toBe(false);
  });
});

describe('createStageSchema', () => {
  it('accepts overlapping-capable stages and enforces range rules', () => {
    expect(
      createStageSchema.safeParse({
        title: 'Computer Science Degree',
        start: validStart,
        end: validEnd,
        ongoing: false,
      }).success,
    ).toBe(true);
    expect(
      createStageSchema.safeParse({
        title: 'Broken',
        start: validEnd,
        end: validStart,
        ongoing: false,
      }).success,
    ).toBe(false);
  });
});

describe('profile schemas', () => {
  it('validates usernames', () => {
    expect(usernameSchema.safeParse('franco18').success).toBe(true);
    expect(usernameSchema.safeParse('Franco').success).toBe(false); // uppercase
    expect(usernameSchema.safeParse('fr').success).toBe(false); // too short
    expect(usernameSchema.safeParse('has space').success).toBe(false);
    expect(usernameSchema.safeParse('franco_18').success).toBe(false); // underscore no longer allowed
    expect(usernameSchema.safeParse('a'.repeat(16)).success).toBe(false); // over 15 chars
    expect(usernameSchema.safeParse('a'.repeat(15)).success).toBe(true); // exactly 15 is fine
  });

  it('validates website URLs as http(s)', () => {
    const base = { displayName: 'Franco', locale: 'es' } as const;
    expect(updateProfileSchema.safeParse({ ...base, website: 'https://example.com' }).success).toBe(
      true,
    );
    expect(updateProfileSchema.safeParse({ ...base, website: 'javascript:alert(1)' }).success).toBe(
      false,
    );
  });
});
