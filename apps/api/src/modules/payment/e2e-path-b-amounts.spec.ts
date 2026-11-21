import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIMIT_WON, parseLimitWon, planAmounts } from './e2e-path-b-amounts.js';

describe('planAmounts', () => {
  it('keeps the original fixed amounts at the default limit', () => {
    const a = planAmounts(DEFAULT_LIMIT_WON);
    expect(a).toEqual({
      limit: okrwToAokrw(10_000n),
      fund: okrwToAokrw(10_500n),
      orderA: okrwToAokrw(9_000n),
      tightLimit: okrwToAokrw(500n),
      refusal: okrwToAokrw(1_000n),
      frozenProbe: okrwToAokrw(400n),
    });
  });

  it('scales every amount from the limit and keeps the ordering the steps rely on', () => {
    for (const won of [100n, 137n, 2_000n, 1_000_000n]) {
      const a = planAmounts(won);
      expect(a.orderA).toBeLessThan(a.limit);
      expect(a.refusal).toBeGreaterThan(a.tightLimit);
      expect(a.frozenProbe).toBeLessThan(a.tightLimit);
      expect(a.orderA + a.refusal).toBeLessThanOrEqual(a.fund);
      expect(a.fund).toBeGreaterThan(a.limit);
    }
    expect(planAmounts(2_000n).fund).toBe(okrwToAokrw(2_100n));
  });
});

describe('parseLimitWon', () => {
  it('defaults when absent and parses whole OKRW', () => {
    expect(parseLimitWon(undefined)).toBe(10_000n);
    expect(parseLimitWon('2000')).toBe(2_000n);
  });

  it('rejects decimals, signs, zero, junk, and a limit too small to split', () => {
    for (const bad of ['1.5', '-5', '0', '', 'abc', '99', '0100']) {
      expect(() => parseLimitWon(bad)).toThrow(/--limit/);
    }
  });
});
