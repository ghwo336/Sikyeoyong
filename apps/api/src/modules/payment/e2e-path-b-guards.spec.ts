import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import {
  GAS_MARGIN_AOKRW,
  assertOperatorCovers,
  drainWithoutMasking,
} from './e2e-path-b-guards.js';

describe('assertOperatorCovers', () => {
  const FUND = okrwToAokrw(10_500n);

  it('passes at exactly fund plus the gas margin', () => {
    expect(() => {
      assertOperatorCovers(FUND + GAS_MARGIN_AOKRW, FUND);
    }).not.toThrow();
  });

  it('stops one aokrw short with a clear message that says nothing was sent', () => {
    expect(() => {
      assertOperatorCovers(FUND + GAS_MARGIN_AOKRW - 1n, FUND);
    }).toThrow(/is below .*nothing sent/);
  });
});

describe('drainWithoutMasking', () => {
  it('reports a drain failure on its own and does not throw', async () => {
    const lines: string[] = [];
    const ok = await drainWithoutMasking(
      () => Promise.reject(new Error('insufficient funds')),
      (l) => lines.push(l),
    );
    expect(ok).toBe(false);
    expect(lines).toEqual(['e2e drain failed: insufficient funds']);
  });

  it('is true and silent when the drain works', async () => {
    const lines: string[] = [];
    const ok = await drainWithoutMasking(
      () => Promise.resolve(),
      (l) => lines.push(l),
    );
    expect(ok).toBe(true);
    expect(lines).toEqual([]);
  });
});
