import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import {
  dragonStage,
  floatCapAokrw,
  getPolicy,
  hasLimitIntent,
  isInRange,
  isPolicyProfile,
  nagStage,
  perOrderLimitToFit,
  POLICY_PROFILES,
} from './policy.js';

// verify-allow: R4 independent oracle for expected values, not production code
const OKRW = 10n ** 18n;
const won = (n: bigint) => n * OKRW;

describe('getPolicy (D-07, D-12, D-31)', () => {
  it('default profile matches D-07 and D-31', () => {
    const p = getPolicy('default');
    expect(p.perOrderLimit).toEqual({
      minAokrw: won(5_000n),
      maxAokrw: won(50_000n),
      stepAokrw: won(5_000n),
      initialAokrw: won(10_000n),
    });
    expect(p.myPeriodicLimit).toEqual({
      minAokrw: won(50_000n),
      maxAokrw: won(500_000n),
      stepAokrw: won(50_000n),
      initialAokrw: won(300_000n),
    });
    expect(p.periodicCapAokrw).toBe(won(500_000n));
    expect(p.periodicPeriodSec).toBe(2_592_000);
    expect(p.unverifiedPerTxAokrw).toBe(won(2_000_000n));
    expect(p.unverifiedPerDayAokrw).toBe(won(10_000_000n));
    expect(p.nagThresholdsBps).toEqual([7_000, 9_000, 10_000]);
    expect(p.approvalTtlMs).toBe(600_000);
  });

  it('demo profile shortens the 30-day cap and starts my limit at it, so scene 14 is a chain revert (D-12, D-31)', () => {
    const d = getPolicy('demo');
    const p = getPolicy('default');
    expect(d.periodicCapAokrw).toBe(won(60_000n));
    expect(d.periodicPeriodSec).toBe(3_600);
    expect(d.perOrderLimit).toEqual(p.perOrderLimit);
    expect(d.myPeriodicLimit.maxAokrw).toBe(d.periodicCapAokrw);
    expect(d.myPeriodicLimit.initialAokrw).toBe(d.periodicCapAokrw);
  });

  it('every range starts on a step and its initial value can be picked', () => {
    for (const profile of POLICY_PROFILES) {
      const p = getPolicy(profile);
      for (const r of [p.perOrderLimit, p.myPeriodicLimit]) {
        expect(isInRange(r, r.initialAokrw)).toBe(true);
        expect(isInRange(r, r.maxAokrw)).toBe(true);
      }
      // My 30-day limit can never be set above the chain's shared cap.
      expect(p.myPeriodicLimit.maxAokrw).toBe(p.periodicCapAokrw);
    }
  });

  it('keeps scene 4 working: 45,000 is blocked at the first 10,000 and fits at 45,000 (D-12, D-31)', () => {
    const p = getPolicy('default');
    const scene4 = won(45_000n);
    expect(scene4 > p.perOrderLimit.initialAokrw).toBe(true);
    expect(perOrderLimitToFit(p, scene4)).toBe(won(45_000n));
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

describe('isInRange (D-31)', () => {
  const r = getPolicy('default').perOrderLimit;
  it.each([
    [won(5_000n), true],
    [won(50_000n), true],
    [won(25_000n), true],
    [won(4_999n), false],
    [won(55_000n), false],
    [won(12_000n), false],
    [won(10_000n) + 1n, false],
    [0n, false],
  ] as const)('%s is %s', (v, ok) => {
    expect(isInRange(r, v)).toBe(ok);
  });
});

describe('perOrderLimitToFit (Blocked, D-31)', () => {
  const p = getPolicy('default');
  it.each([
    [won(1n), won(5_000n)],
    [won(5_000n), won(5_000n)],
    [won(5_001n), won(10_000n)],
    [won(45_000n), won(45_000n)],
    [won(45_000n) + 1n, won(50_000n)],
    [won(50_000n), won(50_000n)],
  ] as const)('an order of %s fits under %s', (amount, limit) => {
    expect(perOrderLimitToFit(p, amount)).toBe(limit);
  });

  it('is null above the top of the range', () => {
    expect(perOrderLimitToFit(p, won(50_000n) + 1n)).toBeNull();
  });
});

describe('dragonStage (D-31)', () => {
  it.each([
    [won(5_000n), 1],
    [won(10_000n), 1],
    [won(10_000n) + 1n, 2],
    [won(30_000n), 2],
    [won(35_000n), 3],
    [won(50_000n), 3],
  ] as const)('%s is stage %s', (limit, stage) => {
    expect(dragonStage(limit)).toBe(stage);
  });
});

describe('floatCapAokrw (D-06)', () => {
  it('is per-order limit times the multiplier', () => {
    expect(floatCapAokrw(won(10_000n), 2n)).toBe(won(20_000n));
    expect(floatCapAokrw(won(50_000n), 2n)).toBe(won(100_000n));
    expect(floatCapAokrw(won(30_000n), 1n)).toBe(won(30_000n));
  });

  it('rejects a cap above the uint256 range', () => {
    expect(() => floatCapAokrw(won(50_000n), 10n ** 60n)).toThrow(AppError);
  });

  it('rejects multipliers below 1', () => {
    expect(() => floatCapAokrw(won(10_000n), 0n)).toThrow(AppError);
    expect(() => floatCapAokrw(won(10_000n), -1n)).toThrow(AppError);
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

describe('trial allowance (Budget.dc.html, user-flow 5)', () => {
  it('is 100,000 won in every profile', () => {
    for (const profile of ['default', 'demo'] as const) {
      expect(getPolicy(profile).trialAllowanceAokrw).toBe(100_000n * OKRW);
    }
  });
});

describe('hasLimitIntent (D-21 injection gate)', () => {
  it('reads decomposed (NFD) Korean the same as composed text', () => {
    const nfd = '5만 원까지 올려 줘'.normalize('NFD');
    expect(nfd).not.toBe('5만 원까지 올려 줘');
    expect(hasLimitIntent(nfd)).toBe(true);
    expect(hasLimitIntent('예산'.normalize('NFD'))).toBe(true);
  });

  it('counts digits then 원, with or without a space', () => {
    expect(hasLimitIntent('50000원')).toBe(true);
    expect(hasLimitIntent('50,000 원')).toBe(true);
  });

  it.each([
    '한 번에 5만 원까지 올려 줘',
    '회식 때 보쌈도 시킬 수 있게 한도 좀 늘려',
    '예산 줄여 줘',
    '30일 한도 내려',
    '50,000원으로 해 줘',
    '3만원까지',
  ])('sees a limit wish in %s', (text) => {
    expect(hasLimitIntent(text)).toBe(true);
  });

  it.each([
    '점심 시켜 줘. 따뜻한 걸로',
    '돼지국밥으로',
    '더 싼 거 없어?',
    '비 내리는 날 국물 시켜 줘',
    '눈 내리니까 따뜻한 거',
    '올리브 피자',
    '치즈 듬뿍 올리고',
    '줄이 길어?',
    '',
  ])('sees none in %s', (text) => {
    expect(hasLimitIntent(text)).toBe(false);
  });
});
