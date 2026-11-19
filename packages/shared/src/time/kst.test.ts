import { describe, expect, it } from 'vitest';
import { kstMonthOf, kstMonthRange } from './kst.js';

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

  it.each(['2026-13', '2026-1', '26-12', '2026-12-01', ''])('refuses %j', (bad) => {
    expect(() => kstMonthRange(bad)).toThrow();
  });
});
