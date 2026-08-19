import type { CalendarDate, PartialDate } from '@timeline/shared';
import { parseDateString } from '@timeline/shared';

/**
 * Canvas time arithmetic runs on "day numbers": whole days since the Unix
 * epoch (UTC). They are plain numbers, so scale math stays trivial and exact.
 */

const MS_PER_DAY = 86_400_000;

export function calendarDateToDayNumber(cd: CalendarDate): number {
  return Math.round(Date.UTC(cd.year, cd.month - 1, cd.day) / MS_PER_DAY);
}

export function dayNumberToCalendarDate(day: number): CalendarDate {
  const date = new Date(Math.floor(day) * MS_PER_DAY);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function partialDateToDayNumber(pd: PartialDate): number | null {
  const parsed = parseDateString(pd.date);
  return parsed ? calendarDateToDayNumber(parsed) : null;
}

/** Today in the user's local calendar, as a day number. */
export function todayDayNumber(): number {
  const now = new Date();
  return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY);
}
