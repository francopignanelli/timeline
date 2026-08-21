import { useMemo, useRef, useState } from 'react';
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

/** Round-trips through the app's own DD/MM/YYYY parser so day/month/year get exactly its calendar validation (Feb 31, etc.). */
function candidateOrNull(day: number, month: number, year: number): CalendarDate | null {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
  return parseDateString(formatDateString({ day, month, year }));
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
   * Every text field below (day/month/year here, and the standalone year
   * field further down) keeps its own buffer while focused instead of being
   * fully controlled by the committed value.
   *
   * It used to be fully controlled and reject anything outside a valid
   * range — which silently reverted the two most common edits: clearing the
   * field ("" parses as 0) and typing a leading zero. Buffering lets those
   * intermediate states exist on screen; only a valid value is committed
   * upstream, and blur discards anything left incomplete.
   */
  const [dayText, setDayText] = useState<string | null>(null);
  const [monthText, setMonthText] = useState<string | null>(null);
  const [dayYearText, setDayYearText] = useState<string | null>(null);
  const monthFieldRef = useRef<HTMLInputElement>(null);
  const dayYearFieldRef = useRef<HTMLInputElement>(null);

  const displayedDay = dayText ?? (parsed ? String(parsed.day).padStart(2, '0') : '');
  const displayedMonthDigits = monthText ?? (parsed ? String(parsed.month).padStart(2, '0') : '');
  const displayedDayYear = dayYearText ?? (parsed ? String(parsed.year).padStart(4, '0') : '');

  // Commits as soon as all three fields hold *some* digits that together form
  // a valid calendar date — same leniency as the year-only field below,
  // rather than waiting for exactly 2/2/4 digits before anything commits.
  const commitDayPrecision = (day: string, month: string, year: string) => {
    if (day.length === 0 || month.length === 0 || year.length === 0) return;
    const candidate = candidateOrNull(Number(day), Number(month), Number(year));
    if (candidate) onChange({ date: formatDateString(candidate), precision: 'DAY' });
  };

  const handleDayChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setDayText(digits);
    commitDayPrecision(digits, displayedMonthDigits, displayedDayYear);
    if (digits.length === 2) monthFieldRef.current?.focus();
  };

  const handleMonthDigitsChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setMonthText(digits);
    commitDayPrecision(displayedDay, digits, displayedDayYear);
    if (digits.length === 2) dayYearFieldRef.current?.focus();
  };

  const handleDayYearChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setDayYearText(digits);
    commitDayPrecision(displayedDay, displayedMonthDigits, digits);
  };

  /*
   * Clearing a buffer on that field's own blur (as the standalone year field
   * below does) is wrong here: tabbing day → month → year blurs day before
   * month and year exist to complete the commit, so an incomplete trio never
   * commits — and the buffer-clear then made the just-typed digits vanish
   * the moment focus moved to the next field, even though the user was still
   * mid-entry. Only clear when focus leaves the group of three entirely.
   */
  const clearDayPrecisionBuffersIfGroupBlurred = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDayText(null);
      setMonthText(null);
      setDayYearText(null);
    }
  };

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
      <div className="flex flex-wrap items-center gap-2">
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
          // Three plain digit fields in DD/MM/YYYY order, not
          // `<input type="date">`: a native date input's displayed format
          // (mm/dd/yyyy vs dd/mm/yyyy) follows the browser/OS locale, not
          // this app's own i18n language or its DD/MM/YYYY domain convention
          // (CLAUDE.md) — there is no way to override that from HTML/CSS, so
          // it could silently show the wrong order regardless of app
          // language. This is always DD/MM/YYYY, unconditionally.
          <div className="flex items-center gap-1" onBlur={clearDayPrecisionBuffersIfGroupBlurred}>
            <input
              type="text"
              inputMode="numeric"
              aria-label={t('dates.day')}
              placeholder={t('dates.dayPlaceholder')}
              maxLength={2}
              value={displayedDay}
              onChange={(e) => handleDayChange(e.target.value)}
              className={`${inputClasses} w-14 text-center font-mono`}
            />
            <span aria-hidden="true" className="text-text-muted">
              /
            </span>
            <input
              ref={monthFieldRef}
              type="text"
              inputMode="numeric"
              aria-label={t('dates.month')}
              placeholder={t('dates.monthPlaceholder')}
              maxLength={2}
              value={displayedMonthDigits}
              onChange={(e) => handleMonthDigitsChange(e.target.value)}
              className={`${inputClasses} w-14 text-center font-mono`}
            />
            <span aria-hidden="true" className="text-text-muted">
              /
            </span>
            <input
              ref={dayYearFieldRef}
              type="text"
              inputMode="numeric"
              aria-label={t('dates.year')}
              placeholder={t('dates.yearPlaceholder')}
              maxLength={4}
              value={displayedDayYear}
              onChange={(e) => handleDayYearChange(e.target.value)}
              className={`${inputClasses} w-20 text-center font-mono`}
            />
          </div>
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
