import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { SpendGuard, readOperatorKey, worstCaseGas } from './connect.ts';

const E18 = okrwToAokrw(1n);

describe('SpendGuard', () => {
  it('spent is the start balance minus the current balance', () => {
    const g = new SpendGuard(1_000n, 500n);
    expect(g.spent(1_000n)).toBe(0n);
    expect(g.spent(940n)).toBe(60n);
  });

  it('passes when spent + worst equals the budget exactly', () => {
    const g = new SpendGuard(1_000n, 100n);
    // spent 40, worst 6 * 10 = 60, total 100
    expect(() => {
      g.assertCanSpend(960n, 6n, 10n);
    }).not.toThrow();
  });

  it('throws when spent + worst is one aokrw over the budget', () => {
    const g = new SpendGuard(1_000n, 100n);
    // spent 40, worst 61, total 101
    expect(() => {
      g.assertCanSpend(960n, 61n, 1n);
    }).toThrow(/gas budget/);
  });

  it('counts spent from the balance drop, not only the worst case', () => {
    const g = new SpendGuard(1_000n, 100n);
    // worst alone (60) fits, but spent 41 pushes it over
    expect(() => {
      g.assertCanSpend(959n, 60n, 1n);
    }).toThrow(/gas budget/);
    expect(() => {
      g.assertCanSpend(1_000n, 60n, 1n);
    }).not.toThrow();
  });

  it('zero budget allows only a zero cost write', () => {
    const g = new SpendGuard(5n, 0n);
    expect(() => {
      g.assertCanSpend(5n, 0n, 7n);
    }).not.toThrow();
    expect(() => {
      g.assertCanSpend(5n, 1n, 1n);
    }).toThrow(/gas budget/);
  });

  it('is exact above 10^24 aokrw (no float rounding)', () => {
    const start = 3n * 10n ** 24n;
    const budget = 10n ** 24n + 7n;
    const g = new SpendGuard(start, budget);
    const current = start - 10n ** 24n; // spent exactly 10^24
    expect(() => {
      g.assertCanSpend(current, 7n, 1n);
    }).not.toThrow();
    expect(() => {
      g.assertCanSpend(current, 8n, 1n);
    }).toThrow(/gas budget/);
  });

  it('multiplies gas limit and price as bigint', () => {
    const g = new SpendGuard(10n ** 25n, 2n * E18);
    expect(() => {
      g.assertCanSpend(10n ** 25n, 2_000_000n, 10n ** 12n);
    }).not.toThrow();
    expect(() => {
      g.assertCanSpend(10n ** 25n, 2_000_001n, 10n ** 12n);
    }).toThrow(/gas budget/);
  });

  it('error message names OKRW amounts', () => {
    const g = new SpendGuard(10n * E18, E18);
    expect(() => {
      g.assertCanSpend(10n * E18, 2n, E18);
    }).toThrow(/spent 0 \+ worst case 2 passes 1 OKRW/);
  });
});

describe('worstCaseGas', () => {
  it('doubles the estimate (half of the limit is charged even when unused)', () => {
    expect(worstCaseGas(0n)).toBe(0n);
    expect(worstCaseGas(21_000n)).toBe(42_000n);
    expect(worstCaseGas(10n ** 24n)).toBe(2n * 10n ** 24n);
  });
});

describe('readOperatorKey', () => {
  const key = 'ab'.repeat(32);
  it('accepts a key with or without 0x', () => {
    expect(readOperatorKey({ OPERATOR_KEY: key })).toBe(`0x${key}`);
    expect(readOperatorKey({ OPERATOR_KEY: `0x${key}` })).toBe(`0x${key}`);
  });
  it('rejects a bad key without echoing it', () => {
    expect(() => readOperatorKey({ OPERATOR_KEY: 'secret-not-hex' })).toThrow(/OPERATOR_KEY/);
    try {
      readOperatorKey({ OPERATOR_KEY: 'secret-not-hex' });
    } catch (e) {
      expect(String(e)).not.toContain('secret-not-hex');
    }
    expect(() => readOperatorKey({})).toThrow(/OPERATOR_KEY/);
  });
});
