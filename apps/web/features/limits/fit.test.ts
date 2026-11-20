import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { limitToFit, needsApprovalNow } from './fit';

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
