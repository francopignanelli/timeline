import { describe, expect, it } from 'vitest';
import type { Timeline } from '@timeline/shared';
import { buildCanvasItems } from './canvas-items';
import type { CanvasContent } from './canvas-items';
import { calendarDateToDayNumber } from './domain/day-number';

const TODAY = calendarDateToDayNumber({ year: 2026, month: 6, day: 15 });

const baseTimeline: Timeline = {
  id: 't1',
  ownerId: 'owner',
  title: 'A timeline',
  start: { date: '01/01/2020', precision: 'YEAR' },
  ongoing: true,
  unit: 'YEARS',
  rulerVisible: true,
  visibility: 'PRIVATE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const milestoneRef = (id: string) => ({
  timelineId: 't1',
  milestoneId: id,
  displayOrder: 0,
  isHighlighted: false,
  isHidden: false,
  addedAt: '2026-01-01T00:00:00.000Z',
});

const stageRef = (id: string) => ({
  timelineId: 't1',
  stageId: id,
  isHighlighted: false,
  addedAt: '2026-01-01T00:00:00.000Z',
});

function content(overrides: Partial<CanvasContent> = {}): CanvasContent {
  return { milestones: [], stages: [], ...overrides };
}

describe('buildCanvasItems — timeline boundaries', () => {
  it('exposes the valid window as [timeline start, today]', () => {
    const items = buildCanvasItems(baseTimeline, content(), TODAY, 'en', 'Present');
    expect(items.boundStart).toBe(calendarDateToDayNumber({ year: 2020, month: 1, day: 1 }));
    expect(items.boundEnd).toBe(TODAY);
  });

  it('drops a milestone dated before the timeline start', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: { id: 'm1', title: 'Too early', date: { date: '01/01/2015', precision: 'YEAR' } },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones).toHaveLength(0);
  });

  it('drops a milestone dated in the future', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: { id: 'm1', title: 'Not yet', date: { date: '01/01/2030', precision: 'YEAR' } },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones).toHaveLength(0);
  });

  it('keeps a milestone inside the valid window', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: { id: 'm1', title: 'In range', date: { date: '01/06/2022', precision: 'MONTH' } },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones).toHaveLength(1);
    expect(items.milestones[0]?.id).toBe('m1');
  });

  it('clips a stage that starts before the timeline start to the boundary', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        stages: [
          {
            ref: stageRef('s1'),
            stage: {
              id: 's1',
              title: 'Spans the start',
              start: { date: '01/01/2018', precision: 'YEAR' },
              end: { date: '01/01/2021', precision: 'YEAR' },
              ongoing: false,
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.stages).toHaveLength(1);
    expect(items.stages[0]?.startDay).toBe(items.boundStart);
    expect(items.stages[0]?.endDay).toBe(calendarDateToDayNumber({ year: 2021, month: 1, day: 1 }));
    // The label keeps the stage's true dates even though the band is clipped.
    expect(items.stages[0]?.rangeLabel).toContain('2018');
  });

  it('clips an ongoing stage to today, not beyond', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        stages: [
          {
            ref: stageRef('s1'),
            stage: {
              id: 's1',
              title: 'Ongoing',
              start: { date: '01/01/2021', precision: 'YEAR' },
              ongoing: true,
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.stages[0]?.endDay).toBe(TODAY);
  });

  it('drops a stage that falls entirely before the timeline start', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        stages: [
          {
            ref: stageRef('s1'),
            stage: {
              id: 's1',
              title: 'Ancient history',
              start: { date: '01/01/2010', precision: 'YEAR' },
              end: { date: '01/01/2015', precision: 'YEAR' },
              ongoing: false,
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.stages).toHaveLength(0);
  });

  it('fits tightly to a completed timeline’s own range, not out to today', () => {
    const ended: Timeline = {
      ...baseTimeline,
      ongoing: false,
      end: { date: '01/01/2022', precision: 'YEAR' },
    };
    const items = buildCanvasItems(ended, content(), TODAY, 'en', 'Present');
    expect(items.fitEnd).toBe(calendarDateToDayNumber({ year: 2022, month: 1, day: 1 }));
    expect(items.fitEnd).toBeLessThan(TODAY);
  });

  it('fit never exceeds the hard boundaries even with out-of-range content', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: { id: 'm1', title: 'Future', date: { date: '01/01/2099', precision: 'YEAR' } },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.fitStart).toBeGreaterThanOrEqual(items.boundStart);
    expect(items.fitEnd).toBeLessThanOrEqual(items.boundEnd);
  });
});

describe('buildCanvasItems — short label display', () => {
  it('uses shortLabel as the display label when set, but keeps title intact', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: {
              id: 'm1',
              title: 'The Wall — Live at River Plate Stadium',
              shortLabel: 'The Wall',
              date: { date: '01/06/2022', precision: 'MONTH' },
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones[0]?.label).toBe('The Wall');
    expect(items.milestones[0]?.title).toBe('The Wall — Live at River Plate Stadium');
  });

  it('falls back to title when shortLabel is unset', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: { id: 'm1', title: 'No short label here', date: { date: '01/06/2022', precision: 'MONTH' } },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones[0]?.label).toBe('No short label here');
  });

  it('falls back to title when shortLabel is an empty string (explicitly cleared)', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        milestones: [
          {
            ref: milestoneRef('m1'),
            milestone: {
              id: 'm1',
              title: 'Cleared short label',
              shortLabel: '',
              date: { date: '01/06/2022', precision: 'MONTH' },
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.milestones[0]?.label).toBe('Cleared short label');
  });

  it('applies the same fallback to stages', () => {
    const items = buildCanvasItems(
      baseTimeline,
      content({
        stages: [
          {
            ref: stageRef('s1'),
            stage: {
              id: 's1',
              title: 'University of Buenos Aires, Computer Science',
              shortLabel: 'University',
              start: { date: '01/01/2020', precision: 'YEAR' },
              ongoing: true,
            },
          },
        ],
      }),
      TODAY,
      'en',
      'Present',
    );
    expect(items.stages[0]?.label).toBe('University');
    expect(items.stages[0]?.title).toBe('University of Buenos Aires, Computer Science');
  });
});
