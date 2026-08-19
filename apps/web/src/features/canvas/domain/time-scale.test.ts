import { describe, it, expect } from 'vitest';
import {
  calendarDateToDayNumber,
  dayNumberToCalendarDate,
  partialDateToDayNumber,
} from './day-number';
import {
  MAX_PX_PER_DAY,
  MIN_PX_PER_DAY,
  dayToX,
  fitRange,
  panByPx,
  visibleRange,
  xToDay,
  zoomAt,
} from './time-scale';

describe('day numbers', () => {
  it('round-trips calendar dates', () => {
    const cd = { day: 28, month: 10, year: 2022 };
    expect(dayNumberToCalendarDate(calendarDateToDayNumber(cd))).toEqual(cd);
  });

  it('is monotonic across the DD/MM string-sort trap', () => {
    const earlier = calendarDateToDayNumber({ day: 28, month: 10, year: 2022 });
    const later = calendarDateToDayNumber({ day: 1, month: 1, year: 2023 });
    expect(later - earlier).toBe(65);
  });

  it('converts PartialDates via their anchor', () => {
    expect(partialDateToDayNumber({ date: '01/01/1970', precision: 'DAY' })).toBe(0);
    expect(partialDateToDayNumber({ date: '02/01/1970', precision: 'YEAR' })).toBe(1);
    expect(partialDateToDayNumber({ date: 'garbage', precision: 'DAY' })).toBeNull();
  });
});

describe('TimeScale mapping', () => {
  const scale = { pxPerDay: 2, startDay: 1000 };

  it('maps days to x and back', () => {
    expect(dayToX(scale, 1000)).toBe(0);
    expect(dayToX(scale, 1010)).toBe(20);
    expect(xToDay(scale, 20)).toBe(1010);
    expect(xToDay(scale, dayToX(scale, 1234.5))).toBeCloseTo(1234.5, 10);
  });

  it('reports the visible range', () => {
    expect(visibleRange(scale, 200)).toEqual({ startDay: 1000, endDay: 1100 });
  });
});

describe('zoomAt', () => {
  it('keeps the date under the anchor fixed', () => {
    const scale = { pxPerDay: 1, startDay: 500 };
    const anchorX = 320;
    const anchorDay = xToDay(scale, anchorX);
    const zoomed = zoomAt(scale, anchorX, 2.7);
    expect(dayToX(zoomed, anchorDay)).toBeCloseTo(anchorX, 8);
  });

  it('clamps zoom and returns the same scale at the limits', () => {
    const atMax = { pxPerDay: MAX_PX_PER_DAY, startDay: 0 };
    expect(zoomAt(atMax, 100, 2)).toBe(atMax);
    const atMin = { pxPerDay: MIN_PX_PER_DAY, startDay: 0 };
    expect(zoomAt(atMin, 100, 0.5)).toBe(atMin);
  });
});

describe('panByPx', () => {
  it('moves content with the drag direction', () => {
    const scale = { pxPerDay: 2, startDay: 1000 };
    // Dragging 50px to the right reveals earlier days.
    expect(panByPx(scale, 50).startDay).toBe(975);
    expect(panByPx(scale, -50).startDay).toBe(1025);
  });
});

describe('fitRange', () => {
  it('fits the range inside the viewport with padding', () => {
    const fitted = fitRange(1000, 1365, 1000, 64);
    expect(dayToX(fitted, 1000)).toBeCloseTo(64, 6);
    expect(dayToX(fitted, 1365)).toBeCloseTo(936, 6);
  });

  it('handles a single-day range without blowing up', () => {
    const fitted = fitRange(1000, 1000, 800);
    expect(fitted.pxPerDay).toBeLessThanOrEqual(MAX_PX_PER_DAY);
    expect(fitted.pxPerDay).toBeGreaterThan(0);
  });
});
