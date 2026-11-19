import { describe, expect, it } from 'vitest';
import {
  formatKstClock,
  formatKstDate,
  formatKstDateTime,
  kstDaysBetween,
  kstMonthOf,
  kstMonthRange,
} from './kst.js';

// Expected values written by hand: KST = UTC+9, no DST.
describe('kstMonthOf', () => {
  it.each([
    ['2026-11-30T14:59:59.999Z', '2026-11'], // 23:59:59.999 KST on Nov 30
    ['2026-11-30T15:00:00.000Z', '2026-12'], // 00:00 KST on Dec 1
    ['2026-12-31T15:00:00.000Z', '2027-01'], // new year in Seoul, still Dec 31 in UTC
    ['2028-02-28T15:00:00.000Z', '2028-02'], // Feb 29 in a leap year
  ])('%s is %s in Seoul', (iso, month) => {
    expect(kstMonthOf(Date.parse(iso))).toBe(month);
  });

  it('refuses non-integer times', () => {
    expect(() => kstMonthOf(1.5)).toThrow();
    expect(() => kstMonthOf(Number.NaN)).toThrow();
    expect(() => kstMonthOf(8.64e15 + 1)).toThrow();
  });
});

describe('kstMonthRange', () => {
  it('starts at 00:00 KST on the 1st and ends at the next month start', () => {
    expect(kstMonthRange('2026-12')).toEqual({
      startMs: Date.parse('2026-11-30T15:00:00.000Z'),
      endMs: Date.parse('2026-12-31T15:00:00.000Z'),
    });
    expect(kstMonthRange('2028-02').endMs - kstMonthRange('2028-02').startMs).toBe(
      29 * 24 * 60 * 60 * 1000,
    );
  });

  it('round-trips with kstMonthOf at both edges', () => {
    const { startMs, endMs } = kstMonthRange('2027-01');
    expect(kstMonthOf(startMs)).toBe('2027-01');
    expect(kstMonthOf(endMs - 1)).toBe('2027-01');
    expect(kstMonthOf(endMs)).toBe('2027-02');
  });

  it.each(['2026-13', '2026-1', '26-12', '2026-12-01', '', '0000-01', '0099-12', '1969-12'])(
    'refuses %j',
    (bad) => {
      expect(() => kstMonthRange(bad)).toThrow();
    },
  );
});

// Moved from packages/ui (OrderStatusHeader, IdCard, CapReached). Same hand-written cases.
describe('formatKstClock', () => {
  it.each([
    [Date.UTC(2026, 11, 9, 3, 55), '12시 55분'],
    [Date.UTC(2026, 11, 9, 15, 5), '0시 5분'], // past midnight in Seoul
    [Date.UTC(2026, 11, 9, 4, 5), '13시 5분'],
  ])('%s is %s', (ms, text) => {
    expect(formatKstClock(ms)).toBe(text);
  });
});

describe('formatKstDate', () => {
  it('turns the date at Seoul midnight', () => {
    expect(formatKstDate(Date.UTC(2026, 10, 30, 15, 0))).toBe('2026. 12. 1.'); // 00:00 KST
    expect(formatKstDate(Date.UTC(2026, 10, 30, 14, 59))).toBe('2026. 11. 30.');
  });
});

describe('formatKstDateTime', () => {
  it.each([
    [Date.UTC(2026, 11, 3, 5, 0), '12월 3일 오후 2시'],
    [Date.UTC(2026, 11, 3, 0, 30), '12월 3일 오전 9시 30분'],
    [Date.UTC(2026, 11, 2, 15, 0), '12월 3일 오전 12시'], // midnight KST
    [Date.UTC(2026, 11, 3, 3, 0), '12월 3일 오후 12시'], // noon KST
    [Date.UTC(2026, 11, 31, 15, 1), '1월 1일 오전 12시 1분'],
  ])('%s is %s', (ms, text) => {
    expect(formatKstDateTime(ms)).toBe(text);
  });
});

describe('kstDaysBetween', () => {
  const reset = Date.UTC(2026, 11, 3, 5, 0); // Dec 3 14:00 KST
  const day = 86_400_000;
  it('counts Seoul calendar days, not 24-hour blocks', () => {
    expect(kstDaysBetween(Date.UTC(2026, 11, 2, 14, 30), reset)).toBe(1); // Dec 2 23:30 KST
    expect(kstDaysBetween(Date.UTC(2026, 11, 2, 15, 0), reset)).toBe(0); // Dec 3 00:00 KST
    expect(kstDaysBetween(reset - 4 * day, reset)).toBe(4);
    expect(kstDaysBetween(reset + day, reset)).toBe(-1);
  });
});

describe('KST formatting input', () => {
  it('refuses times that are not finite or out of Date range', () => {
    expect(() => formatKstClock(Number.NaN)).toThrow();
    expect(() => formatKstDate(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => formatKstDateTime(8.64e15 + 1)).toThrow();
    expect(() => kstDaysBetween(0, Number.NaN)).toThrow();
  });
});
