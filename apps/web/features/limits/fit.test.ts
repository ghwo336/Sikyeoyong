import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { limitToFit, needsApprovalNow, raisePlan, thirtyDayFloor } from './fit';

const won = okrwToAokrw;

describe('limitToFit (D-31: 5,000 steps up to 50,000)', () => {
  it('is the smallest step that covers the order', () => {
    expect(limitToFit(won(9_000n))).toBe(won(10_000n));
    expect(limitToFit(won(45_000n))).toBe(won(45_000n));
    expect(limitToFit(won(45_000n) + 1n)).toBe(won(50_000n));
  });

  it('is undefined above the top', () => {
    expect(limitToFit(won(50_000n) + 1n)).toBeUndefined();
  });
});

describe('needsApprovalNow (the recommendation rule, recommend/score.ts)', () => {
  const s = (n: bigint) => won(n).toString();
  const limits = {
    perOrderLimit: s(10_000n),
    myPeriodicLimit: s(500_000n),
    chainCap: s(500_000n),
    chainUsed: s(0n),
  };

  it('asks over the per-order limit and clears after a raise', () => {
    expect(needsApprovalNow(won(12_000n), limits)).toBe(true);
    expect(needsApprovalNow(won(10_000n), limits)).toBe(false);
    expect(needsApprovalNow(won(12_000n), { ...limits, perOrderLimit: s(15_000n) })).toBe(false);
  });

  it('asks over my 30-day limit only while it is below the shared cap', () => {
    const mine = { ...limits, myPeriodicLimit: s(100_000n), chainUsed: s(95_000n) };
    expect(needsApprovalNow(won(6_000n), mine)).toBe(true);
    expect(needsApprovalNow(won(5_000n), mine)).toBe(false);
    expect(needsApprovalNow(won(6_000n), { ...limits, chainUsed: s(495_000n) })).toBe(false);
  });
});

describe('thirtyDayFloor (D-31: the 30-day limit is never under the per-order one)', () => {
  const demo = { min: won(10_000n), max: won(500_000n), step: won(10_000n) };
  it('is the smallest 30-day step at or above the per-order limit', () => {
    expect(thirtyDayFloor(won(5_000n), demo)).toBe(won(10_000n));
    expect(thirtyDayFloor(won(10_000n), demo)).toBe(won(10_000n));
    expect(thirtyDayFloor(won(15_000n), demo)).toBe(won(20_000n));
    expect(thirtyDayFloor(won(50_000n), demo)).toBe(won(50_000n));
  });

  it('never goes over the top of the range', () => {
    expect(thirtyDayFloor(won(600_000n), demo)).toBe(won(500_000n));
  });
});

describe('raisePlan (Blocked raise, D-31)', () => {
  const s = (n: bigint) => won(n).toString();
  const budget = (mine: bigint, max = 500_000n) => ({
    myPeriodicLimit: s(mine),
    limitRanges: {
      perOrder: { min: s(5_000n), max: s(50_000n), step: s(5_000n) },
      myPeriodic: { min: s(10_000n), max: s(max), step: s(10_000n) },
    },
  });
  it('only the per-order step while the 30 days already cover it', () => {
    expect(raisePlan(won(12_000n), budget(60_000n))).toEqual({ perOrder: won(15_000n) });
    expect(raisePlan(won(12_000n), budget(15_000n))).toEqual({ perOrder: won(15_000n) });
  });
  it('the 30 days follow to the next step when under it, never past the cap', () => {
    expect(raisePlan(won(12_000n), budget(10_000n))).toEqual({
      perOrder: won(15_000n),
      myPeriodic: won(20_000n),
    });
    expect(raisePlan(won(12_000n), budget(10_000n, 10_000n))).toBeUndefined();
    expect(raisePlan(won(60_000n), budget(500_000n))).toBeUndefined();
  });
});
