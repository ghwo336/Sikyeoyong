import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import { floatCapAokrw, getPolicy, isPolicyProfile, nagStage } from './policy.js';

// verify-allow: R4 independent oracle for expected values, not production code
const OKRW = 10n ** 18n;
const won = (n: bigint) => n * OKRW;

describe('getPolicy (D-07, D-12)', () => {
  it('default profile matches D-07', () => {
    const p = getPolicy('default');
    expect(p.perOrderLimitAokrw).toEqual({ 1: won(10_000n), 2: won(30_000n), 3: won(50_000n) });
    expect(p.periodicCapAokrw).toBe(won(500_000n));
    expect(p.periodicPeriodSec).toBe(2_592_000);
    expect(p.unverifiedPerTxAokrw).toBe(won(2_000_000n));
    expect(p.unverifiedPerDayAokrw).toBe(won(10_000_000n));
    expect(p.defaultMonthlyBudgetAokrw).toBe(won(300_000n));
    expect(p.nagThresholdsBps).toEqual([7_000, 9_000, 10_000]);
    expect(p.approvalTtlMs).toBe(600_000);
  });

  it('demo profile shortens only the 30-day cap (D-12)', () => {
    const d = getPolicy('demo');
    const p = getPolicy('default');
    expect(d.periodicCapAokrw).toBe(won(60_000n));
    expect(d.periodicPeriodSec).toBe(3_600);
    expect(d.perOrderLimitAokrw).toEqual(p.perOrderLimitAokrw);
    expect(d.defaultMonthlyBudgetAokrw).toBe(p.defaultMonthlyBudgetAokrw);
  });

  it('keeps scene 4 working: 45,000 is blocked at Lv1 and allowed at Lv3 (D-12)', () => {
    const p = getPolicy('default');
    const scene4 = won(45_000n);
    expect(scene4 > p.perOrderLimitAokrw[1]).toBe(true);
    expect(scene4 <= p.perOrderLimitAokrw[3]).toBe(true);
  });

  it('levels strictly increase', () => {
    const l = getPolicy('default').perOrderLimitAokrw;
    expect(l[1] < l[2] && l[2] < l[3]).toBe(true);
  });

  it('rejects unknown profiles at runtime', () => {
    expect(() => getPolicy('prod' as 'default')).toThrow(AppError);
  });

  it('isPolicyProfile', () => {
    expect(isPolicyProfile('default')).toBe(true);
    expect(isPolicyProfile('demo')).toBe(true);
    expect(isPolicyProfile('prod')).toBe(false);
  });
});

describe('floatCapAokrw (D-06)', () => {
  it('is per-order limit times the multiplier', () => {
    const p = getPolicy('default');
    expect(floatCapAokrw(p, 1, 2n)).toBe(won(20_000n));
    expect(floatCapAokrw(p, 3, 2n)).toBe(won(100_000n));
    expect(floatCapAokrw(p, 2, 1n)).toBe(won(30_000n));
  });

  it('rejects a cap above the uint256 range', () => {
    expect(() => floatCapAokrw(getPolicy('default'), 3, 10n ** 60n)).toThrow(AppError);
  });

  it('rejects multipliers below 1', () => {
    expect(() => floatCapAokrw(getPolicy('default'), 1, 0n)).toThrow(AppError);
    expect(() => floatCapAokrw(getPolicy('default'), 1, -1n)).toThrow(AppError);
  });
});

describe('nagStage (tech-spec 3.7: 70, 90, 100 percent)', () => {
  const p = getPolicy('default');
  const budget = won(300_000n);

  it.each([
    [0n, 'none'],
    [won(209_999n), 'none'],
    [won(210_000n), 'warn70'],
    [won(269_999n), 'warn70'],
    [won(270_000n), 'warn90'],
    [won(299_999n), 'warn90'],
    [won(300_000n), 'over100'],
    [won(900_000n), 'over100'],
  ] as const)('spent %s of 300,000 is %s', (spent, stage) => {
    expect(nagStage(p, spent, budget)).toBe(stage);
  });

  it('is exact at the boundary, one aokrw below 70% is none', () => {
    expect(nagStage(p, won(210_000n) - 1n, budget)).toBe('none');
  });

  it('handles a zero budget without dividing', () => {
    expect(nagStage(p, 0n, 0n)).toBe('none');
    expect(nagStage(p, 1n, 0n)).toBe('over100');
  });

  it('works for budgets above 10^24 aokrw', () => {
    const big = 10n ** 30n;
    expect(nagStage(p, (big * 7n) / 10n, big)).toBe('warn70');
  });
});
