import type { PartialDate } from './types';

/**
 * Domain dates use the "DD/MM/YYYY" string format (see docs/DECISIONS.md #16).
 * That format does NOT sort lexicographically, so raw string comparison is
 * forbidden project-wide — every ordering operation must go through these
 * utilities, which parse to a comparable ordinal first.
 */

export interface CalendarDate {
  day: number;
  month: number; // 1-12
  year: number;
}

export const DATE_STRING_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parses "DD/MM/YYYY"; returns null on bad format or impossible calendar dates. */
export function parseDateString(value: string): CalendarDate | null {
  const match = DATE_STRING_RE.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month, year)) return null;
  return { day, month, year };
}

export function isValidDateString(value: string): boolean {
  return parseDateString(value) !== null;
}

export function formatDateString({ day, month, year }: CalendarDate): string {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');
  return `${dd}/${mm}/${yyyy}`;
}

/** Monotonic ordinal (yyyymmdd) — safe for numeric comparison, never for display. */
export function dateOrdinal({ day, month, year }: CalendarDate): number {
  return year * 10_000 + month * 100 + day;
}

function requireParsed(value: string): CalendarDate {
  const parsed = parseDateString(value);
  if (parsed === null) {
    throw new Error(`Invalid domain date string: "${value}" (expected DD/MM/YYYY)`);
  }
  return parsed;
}

export function compareDateStrings(a: string, b: string): number {
  return dateOrdinal(requireParsed(a)) - dateOrdinal(requireParsed(b));
}

/** Orders by canonical anchor date; precision does not affect ordering. */
export function comparePartialDates(a: PartialDate, b: PartialDate): number {
  return compareDateStrings(a.date, b.date);
}

export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  return (Math.floor((month - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Anchor for YEAR precision: first day of the year. */
export function anchorForYear(year: number): string {
  return formatDateString({ day: 1, month: 1, year });
}

/** Anchor for MONTH precision: first day of the month. */
export function anchorForMonth(month: number, year: number): string {
  return formatDateString({ day: 1, month, year });
}

/** Anchor for QUARTER precision: first day of the quarter. */
export function anchorForQuarter(quarter: 1 | 2 | 3 | 4, year: number): string {
  return formatDateString({ day: 1, month: (quarter - 1) * 3 + 1, year });
}

/** UTC Date at midnight for interop with Intl formatting and canvas math. */
export function toUTCDate({ day, month, year }: CalendarDate): Date {
  return new Date(Date.UTC(year, month - 1, day));
}
