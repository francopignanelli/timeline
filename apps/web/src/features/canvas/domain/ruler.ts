import { calendarDateToDayNumber, dayNumberToCalendarDate } from './day-number';
import type { TimeScale } from './time-scale';
import { xToDay } from './time-scale';

/**
 * Adaptive ruler: picks the finest calendar unit whose ticks stay at least
 * MIN_TICK_SPACING_PX apart at the current zoom, then generates the ticks
 * covering the visible range. Labels are formatted by the React layer (Intl).
 */

export type RulerUnit = 'DAYS' | 'MONTHS' | 'QUARTERS' | 'YEARS';

export interface RulerTick {
  day: number;
  year: number;
  month: number; // 1-12
  dayOfMonth: number;
  /** Carries the fuller label (e.g. January shows the year, day 1 shows the month). */
  isPrimary: boolean;
}

export interface RulerSpec {
  unit: RulerUnit;
  step: number; // only > 1 for YEARS
  ticks: RulerTick[];
}

const MIN_TICK_SPACING_PX = 72;
const AVG_DAYS_PER_MONTH = 30.44;
const AVG_DAYS_PER_QUARTER = 91.31;
const AVG_DAYS_PER_YEAR = 365.25;
const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const MAX_TICKS = 400;

export function chooseUnit(pxPerDay: number): { unit: RulerUnit; step: number } {
  if (pxPerDay >= MIN_TICK_SPACING_PX) return { unit: 'DAYS', step: 1 };
  if (pxPerDay * AVG_DAYS_PER_MONTH >= MIN_TICK_SPACING_PX) return { unit: 'MONTHS', step: 1 };
  if (pxPerDay * AVG_DAYS_PER_QUARTER >= MIN_TICK_SPACING_PX) return { unit: 'QUARTERS', step: 1 };
  const yearPx = pxPerDay * AVG_DAYS_PER_YEAR;
  for (const step of YEAR_STEPS) {
    if (yearPx * step >= MIN_TICK_SPACING_PX) return { unit: 'YEARS', step };
  }
  return { unit: 'YEARS', step: YEAR_STEPS[YEAR_STEPS.length - 1] ?? 1000 };
}

export function generateTicks(scale: TimeScale, viewportWidth: number): RulerSpec {
  const { unit, step } = chooseUnit(scale.pxPerDay);
  const start = Math.floor(scale.startDay) - 1;
  const end = Math.ceil(xToDay(scale, viewportWidth)) + 1;
  const first = dayNumberToCalendarDate(start);
  const ticks: RulerTick[] = [];

  const push = (year: number, month: number, dayOfMonth: number, isPrimary: boolean) => {
    const day = calendarDateToDayNumber({ year, month, day: dayOfMonth });
    if (day >= start && day <= end) ticks.push({ day, year, month, dayOfMonth, isPrimary });
    return day;
  };

  if (unit === 'DAYS') {
    for (let d = start; d <= end && ticks.length < MAX_TICKS; d++) {
      const cd = dayNumberToCalendarDate(d);
      ticks.push({
        day: d,
        year: cd.year,
        month: cd.month,
        dayOfMonth: cd.day,
        isPrimary: cd.day === 1,
      });
    }
  } else if (unit === 'MONTHS' || unit === 'QUARTERS') {
    const monthStep = unit === 'MONTHS' ? 1 : 3;
    let year = first.year;
    // Snap to the first unit boundary at or before the range start.
    let month = unit === 'MONTHS' ? first.month : 1 + 3 * Math.floor((first.month - 1) / 3);
    for (let i = 0; i < MAX_TICKS; i++) {
      const day = push(year, month, 1, month === 1);
      if (day > end) break;
      month += monthStep;
      if (month > 12) {
        month -= 12;
        year += 1;
      }
    }
  } else {
    let year = Math.max(1, Math.floor(first.year / step) * step);
    for (let i = 0; i < MAX_TICKS; i++) {
      const day = push(year, 1, 1, true);
      if (day > end) break;
      year += step;
    }
  }

  return { unit, step, ticks };
}
