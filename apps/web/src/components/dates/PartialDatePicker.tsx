import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarDate, DatePrecision, PartialDate } from '@timeline/shared';
import {
  DATE_PRECISIONS,
  anchorForMonth,
  anchorForQuarter,
  anchorForYear,
  formatDateString,
  parseDateString,
  quarterOfMonth,
} from '@timeline/shared';
import { FieldShell, inputClasses } from '../ui/fields';

interface PartialDatePickerProps {
  idPrefix: string;
  label: string;
  value: PartialDate | null;
  onChange: (value: PartialDate | null) => void;
  error?: string;
}

function toISO({ day, month, year }: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fromISO(iso: string): CalendarDate | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const candidate = { day: d, month: m, year: y };
  return parseDateString(formatDateString(candidate));
}

/**
 * Precision-adaptive date input: the precision selector switches the editor
 * between full date, month+year, quarter+year, and year. Emits a PartialDate
 * whose date is the canonical anchor for the chosen precision.
 */
export function PartialDatePicker({ idPrefix, label, value, onChange, error }: PartialDatePickerProps) {
  const { t, i18n } = useTranslation();
  const [uncommittedPrecision, setUncommittedPrecision] = useState<DatePrecision>('DAY');

  const precision = value?.precision ?? uncommittedPrecision;
  const parsed = value ? parseDateString(value.date) : null;
  const currentYear = new Date().getFullYear();

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2020, i, 1))));
  }, [i18n.language]);

  function emitForPrecision(p: DatePrecision, base: CalendarDate | null): void {
    if (p === 'DAY') {
      onChange(base ? { date: formatDateString(base), precision: 'DAY' } : null);
      return;
    }
    const year = base?.year ?? currentYear;
    let anchor: string;
    if (p === 'MONTH') anchor = anchorForMonth(base?.month ?? 1, year);
    else if (p === 'QUARTER') anchor = anchorForQuarter(base ? quarterOfMonth(base.month) : 1, year);
    else anchor = anchorForYear(year);
    onChange({ date: anchor, precision: p });
  }

  const handlePrecisionChange = (p: DatePrecision) => {
    setUncommittedPrecision(p);
    emitForPrecision(p, parsed);
  };

  const setMonth = (month: number) =>
    onChange({ date: anchorForMonth(month, parsed?.year ?? currentYear), precision: 'MONTH' });

  const setQuarter = (q: 1 | 2 | 3 | 4) =>
    onChange({ date: anchorForQuarter(q, parsed?.year ?? currentYear), precision: 'QUARTER' });

  const commitYear = (year: number) => {
    if (precision === 'MONTH') onChange({ date: anchorForMonth(parsed?.month ?? 1, year), precision });
    else if (precision === 'QUARTER')
      onChange({ date: anchorForQuarter(parsed ? quarterOfMonth(parsed.month) : 1, year), precision });
    else onChange({ date: anchorForYear(year), precision });
  };

  /*
   * The year field keeps its own text buffer while focused.
   *
   * It used to be a controlled input that committed on every keystroke and
   * rejected anything outside 1–9999 — which silently reverted the two most
   * common edits: clearing the field ("" parses as 0) and typing a leading
   * zero. Buffering lets those intermediate states exist on screen; only a
   * complete, in-range year is committed, and blur discards anything partial.
   */
  const [yearText, setYearText] = useState<string | null>(null);
  const displayedYear = yearText ?? String(parsed?.year ?? currentYear);

  const handleYearChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setYearText(digits);
    const year = Number(digits);
    if (digits.length > 0 && Number.isInteger(year) && year >= 1 && year <= 9999) {
      commitYear(year);
    }
  };

  // Drop the buffer so the field falls back to the committed value — an
  // incomplete entry never survives losing focus.
  const handleYearBlur = () => setYearText(null);

  const quarterPrefix = i18n.language.startsWith('es') ? 'T' : 'Q';

  return (
    <FieldShell id={`${idPrefix}-precision`} label={label} error={error}>
      <div className="flex flex-wrap gap-2">
        <select
          id={`${idPrefix}-precision`}
          aria-label={t('dates.precisionLabel')}
          value={precision}
          onChange={(e) => handlePrecisionChange(e.target.value as DatePrecision)}
          className={`${inputClasses} w-36`}
        >
          {DATE_PRECISIONS.map((p) => (
            <option key={p} value={p}>
              {t(`dates.precision.${p}`)}
            </option>
          ))}
        </select>

        {precision === 'DAY' && (
          <input
            type="date"
            aria-label={t('dates.day')}
            value={parsed ? toISO(parsed) : ''}
            onChange={(e) => {
              const cd = e.target.value ? fromISO(e.target.value) : null;
              onChange(cd ? { date: formatDateString(cd), precision: 'DAY' } : null);
            }}
            className={`${inputClasses} w-44`}
          />
        )}

        {precision === 'MONTH' && (
          <select
            aria-label={t('dates.month')}
            value={parsed?.month ?? 1}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={`${inputClasses} w-36`}
          >
            {monthNames.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        )}

        {precision === 'QUARTER' && (
          <select
            aria-label={t('dates.quarter')}
            value={parsed ? quarterOfMonth(parsed.month) : 1}
            onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className={`${inputClasses} w-24`}
          >
            {([1, 2, 3, 4] as const).map((q) => (
              <option key={q} value={q}>
                {quarterPrefix}
                {q}
              </option>
            ))}
          </select>
        )}

        {precision !== 'DAY' && (
          <input
            // text + numeric inputMode, not type="number": a number input
            // reports an empty string for anything it considers invalid, which
            // hides exactly the intermediate states the buffer above exists to
            // preserve. Digits are filtered in the handler instead.
            type="text"
            inputMode="numeric"
            aria-label={t('dates.year')}
            maxLength={4}
            value={displayedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            onBlur={handleYearBlur}
            className={`${inputClasses} w-24 font-mono`}
          />
        )}
      </div>
    </FieldShell>
  );
}
