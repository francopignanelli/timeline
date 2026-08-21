import { describe, expect, it } from 'vitest';
import type { PartialDate } from '@timeline/shared';
import { expandedBounds, stageEffectiveEnd, todayPartialDate } from './boundary-expansion';

const date = (d: string): PartialDate => ({ date: d, precision: 'DAY' });

const boundedTimeline = {
  start: date('01/01/2020'),
  end: date('31/12/2022'),
  ongoing: false,
};

const ongoingTimeline = {
  start: date('01/01/2020'),
  end: undefined,
  ongoing: true,
};

describe('expandedBounds', () => {
  it('returns null when the item already fits inside the timeline', () => {
    expect(expandedBounds(boundedTimeline, date('15/06/2021'))).toBeNull();
  });

  it('pulls start earlier for a milestone dated before the current start', () => {
    const patch = expandedBounds(boundedTimeline, date('01/01/2015'));
    expect(patch).toEqual({ start: date('01/01/2015') });
  });

  it('pushes end later for a milestone dated after the current end', () => {
    const patch = expandedBounds(boundedTimeline, date('01/01/2024'));
    expect(patch).toEqual({ end: date('01/01/2024') });
  });

  it('expands both bounds at once for a stage spanning past both edges', () => {
    const patch = expandedBounds(boundedTimeline, date('01/01/2010'), date('01/01/2030'));
    expect(patch).toEqual({ start: date('01/01/2010'), end: date('01/01/2030') });
  });

  it('never touches end on an ongoing timeline, no matter how late the item is', () => {
    const patch = expandedBounds(ongoingTimeline, date('01/01/2099'));
    expect(patch).toEqual(null);
  });

  it('still pulls start earlier on an ongoing timeline', () => {
    const patch = expandedBounds(ongoingTimeline, date('01/01/2015'));
    expect(patch).toEqual({ start: date('01/01/2015') });
  });

  it('uses the item end (a Stage span), not just its start, to decide expansion', () => {
    // Starts inside the range but runs past the current end.
    const patch = expandedBounds(boundedTimeline, date('01/06/2021'), date('01/06/2023'));
    expect(patch).toEqual({ end: date('01/06/2023') });
  });
});

describe('stageEffectiveEnd', () => {
  it('uses the stage’s own end date when it has one', () => {
    expect(stageEffectiveEnd({ end: date('01/01/2022'), ongoing: false })).toEqual(date('01/01/2022'));
  });

  it('falls back to today for an ongoing stage, which has no end date', () => {
    expect(stageEffectiveEnd({ ongoing: true })).toEqual(todayPartialDate());
  });
});
