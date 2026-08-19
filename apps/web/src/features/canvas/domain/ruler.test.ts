import { describe, it, expect } from 'vitest';
import { calendarDateToDayNumber } from './day-number';
import { chooseUnit, generateTicks } from './ruler';

const day = (d: number, m: number, y: number) => calendarDateToDayNumber({ day: d, month: m, year: y });

describe('chooseUnit', () => {
  it('picks days when a single day is wide enough', () => {
    expect(chooseUnit(100)).toEqual({ unit: 'DAYS', step: 1 });
  });

  it('picks months, then quarters, as zoom decreases', () => {
    expect(chooseUnit(5)).toEqual({ unit: 'MONTHS', step: 1 });
    expect(chooseUnit(1)).toEqual({ unit: 'QUARTERS', step: 1 });
  });

  it('picks years with a growing step at far zoom', () => {
    expect(chooseUnit(0.5)).toEqual({ unit: 'YEARS', step: 1 });
    expect(chooseUnit(0.05)).toEqual({ unit: 'YEARS', step: 5 });
    expect(chooseUnit(0.005)).toEqual({ unit: 'YEARS', step: 50 });
  });
});

describe('generateTicks', () => {
  it('generates one tick per year across the visible range', () => {
    const startDay = day(1, 6, 2019);
    const scale = { pxPerDay: 0.5, startDay };
    const width = (day(1, 6, 2023) - startDay) * 0.5;
    const spec = generateTicks(scale, width);
    expect(spec.unit).toBe('YEARS');
    const years = spec.ticks.map((t) => t.year);
    expect(years).toEqual([2020, 2021, 2022, 2023]);
    expect(spec.ticks.every((t) => t.month === 1 && t.dayOfMonth === 1)).toBe(true);
  });

  it('generates month ticks on calendar month starts, with January primary', () => {
    const startDay = day(15, 11, 2021);
    const scale = { pxPerDay: 3, startDay };
    const width = (day(15, 2, 2022) - startDay) * 3;
    const spec = generateTicks(scale, width);
    expect(spec.unit).toBe('MONTHS');
    const months = spec.ticks.map((t) => `${t.month}/${t.year}`);
    expect(months).toEqual(['12/2021', '1/2022', '2/2022']);
    expect(spec.ticks.find((t) => t.month === 1)?.isPrimary).toBe(true);
    expect(spec.ticks.find((t) => t.month === 12)?.isPrimary).toBe(false);
  });

  it('generates quarter ticks on quarter starts', () => {
    const startDay = day(1, 2, 2022);
    const scale = { pxPerDay: 1, startDay };
    const width = (day(1, 11, 2022) - startDay) * 1;
    const spec = generateTicks(scale, width);
    expect(spec.unit).toBe('QUARTERS');
    const months = spec.ticks.map((t) => t.month);
    expect(months).toEqual([4, 7, 10]);
  });

  it('aligns stepped year ticks to multiples of the step', () => {
    const startDay = day(1, 1, 1987);
    const scale = { pxPerDay: 0.05, startDay }; // step 5
    const width = (day(1, 1, 2013) - startDay) * 0.05;
    const spec = generateTicks(scale, width);
    expect(spec.step).toBe(5);
    expect(spec.ticks.map((t) => t.year)).toEqual([1990, 1995, 2000, 2005, 2010]);
  });

  it('caps runaway tick generation', () => {
    const scale = { pxPerDay: 240, startDay: 0 };
    const spec = generateTicks(scale, 1_000_000);
    expect(spec.ticks.length).toBeLessThanOrEqual(400);
  });
});
