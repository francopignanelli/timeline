import type { PartialDate } from '@timeline/shared';
import { parseDateString, quarterOfMonth, toUTCDate } from '@timeline/shared';

/** Locale- and precision-aware display of a PartialDate (never raw DD/MM/YYYY). */
export function formatPartialDate(pd: PartialDate, locale: string): string {
  const parsed = parseDateString(pd.date);
  if (!parsed) return pd.date; // defensive: show raw rather than crash on bad data
  switch (pd.precision) {
    case 'DAY':
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(toUTCDate(parsed));
    case 'MONTH':
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(toUTCDate(parsed));
    case 'QUARTER':
      return `${locale.toLowerCase().startsWith('es') ? 'T' : 'Q'}${quarterOfMonth(parsed.month)} ${parsed.year}`;
    case 'YEAR':
      return String(parsed.year);
    case 'APPROXIMATE':
      return `~${parsed.year}`;
  }
}

/** Compact "2016 → Present" range label for list rows. */
export function formatRangeCompact(
  start: PartialDate,
  end: PartialDate | undefined,
  ongoing: boolean,
  presentLabel: string,
): string {
  const s = parseDateString(start.date);
  const from = s ? String(s.year) : start.date;
  if (ongoing) return `${from} → ${presentLabel}`;
  if (!end) return from;
  const e = parseDateString(end.date);
  return `${from} → ${e ? String(e.year) : end.date}`;
}
