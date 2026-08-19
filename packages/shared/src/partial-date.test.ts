import { describe, it, expect } from 'vitest';
import {
  parseDateString,
  isValidDateString,
  formatDateString,
  dateOrdinal,
  compareDateStrings,
  comparePartialDates,
  quarterOfMonth,
  anchorForYear,
  anchorForMonth,
  anchorForQuarter,
  toUTCDate,
  daysInMonth,
} from './partial-date';

describe('parseDateString', () => {
  it('parses a valid DD/MM/YYYY date', () => {
    expect(parseDateString('28/10/2022')).toEqual({ day: 28, month: 10, year: 2022 });
  });

  it('accepts leap-day on leap years only', () => {
    expect(parseDateString('29/02/2024')).toEqual({ day: 29, month: 2, year: 2024 });
    expect(parseDateString('29/02/2023')).toBeNull();
    expect(parseDateString('29/02/2000')).not.toBeNull(); // divisible by 400
    expect(parseDateString('29/02/1900')).toBeNull(); // divisible by 100, not 400
  });

  it('rejects impossible calendar dates', () => {
    expect(parseDateString('31/04/2024')).toBeNull();
    expect(parseDateString('00/01/2020')).toBeNull();
    expect(parseDateString('01/13/2020')).toBeNull();
    expect(parseDateString('32/01/2020')).toBeNull();
  });

  it('rejects wrong formats', () => {
    expect(parseDateString('2022-10-28')).toBeNull(); // ISO is not the project standard
    expect(parseDateString('1/1/2022')).toBeNull(); // must be zero-padded
    expect(parseDateString('28/10/22')).toBeNull();
    expect(parseDateString('')).toBeNull();
    expect(parseDateString('28/10/2022 ')).toBeNull();
  });
});

describe('ordering', () => {
  it('orders correctly where raw string comparison would fail', () => {
    // Lexicographically "01/01/2023" < "28/10/2022" — the utils must not fall for it.
    expect('01/01/2023' < '28/10/2022').toBe(true);
    expect(compareDateStrings('01/01/2023', '28/10/2022')).toBeGreaterThan(0);
  });

  it('produces monotonic ordinals', () => {
    const a = dateOrdinal({ day: 31, month: 12, year: 2022 });
    const b = dateOrdinal({ day: 1, month: 1, year: 2023 });
    expect(a).toBeLessThan(b);
  });

  it('compares PartialDates by anchor regardless of precision', () => {
    const yearly = { date: '01/01/2022', precision: 'YEAR' as const };
    const daily = { date: '28/10/2022', precision: 'DAY' as const };
    expect(comparePartialDates(yearly, daily)).toBeLessThan(0);
    expect(comparePartialDates(daily, daily)).toBe(0);
  });

  it('throws on invalid input instead of ordering garbage', () => {
    expect(() => compareDateStrings('2022-10-28', '28/10/2022')).toThrow();
  });
});

describe('anchors', () => {
  it('anchors YEAR to January 1st', () => {
    expect(anchorForYear(2022)).toBe('01/01/2022');
  });

  it('anchors MONTH to the 1st', () => {
    expect(anchorForMonth(10, 2022)).toBe('01/10/2022');
  });

  it('anchors QUARTER to the first day of the quarter', () => {
    expect(anchorForQuarter(1, 2022)).toBe('01/01/2022');
    expect(anchorForQuarter(4, 2022)).toBe('01/10/2022');
  });

  it('derives quarter from month', () => {
    expect(quarterOfMonth(1)).toBe(1);
    expect(quarterOfMonth(3)).toBe(1);
    expect(quarterOfMonth(4)).toBe(2);
    expect(quarterOfMonth(10)).toBe(4);
    expect(quarterOfMonth(12)).toBe(4);
  });
});

describe('formatting and interop', () => {
  it('round-trips through format/parse', () => {
    const cd = { day: 5, month: 3, year: 1999 };
    expect(parseDateString(formatDateString(cd))).toEqual(cd);
  });

  it('pads day and month', () => {
    expect(formatDateString({ day: 1, month: 2, year: 2020 })).toBe('01/02/2020');
  });

  it('converts to UTC Date at midnight', () => {
    const d = toUTCDate({ day: 28, month: 10, year: 2022 });
    expect(d.toISOString()).toBe('2022-10-28T00:00:00.000Z');
  });

  it('knows month lengths', () => {
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2023)).toBe(28);
    expect(daysInMonth(4, 2023)).toBe(30);
    expect(daysInMonth(12, 2023)).toBe(31);
  });

  it('isValidDateString mirrors parseDateString', () => {
    expect(isValidDateString('28/10/2022')).toBe(true);
    expect(isValidDateString('31/02/2022')).toBe(false);
  });
});
