import { AppError } from '../errors/index.js';
import { MAX_AOKRW, okrwToAokrw } from '../money/index.js';

/**
 * Policy values (decisions D-07, D-12). Amounts are written in whole OKRW for
 * readability and exposed as aokrw bigint. Ratios are basis points (1/10000)
 * so budget math stays in bigint. Changing a chain-enforced value here also
 * needs `pnpm policy:apply` (chain-and-pcl.md).
 */
export type PolicyProfile = 'default' | 'demo';
export type AgentLevel = 1 | 2 | 3;

export const AGENT_LEVELS: readonly AgentLevel[] = [1, 2, 3];

/** Per-order limit by level, chain-enforced via 8004 TransferLimit (D-07). */
const PER_ORDER_LIMIT_OKRW: { readonly [L in AgentLevel]: bigint } = {
  1: 10_000n,
  2: 30_000n,
  3: 50_000n,
};

/** 30-day cap, chain-enforced via PERIODIC_VOLUME_POLICY on placeOrder (D-07, D-12). */
const PERIODIC_CAP: { readonly [P in PolicyProfile]: { okrw: bigint; periodSec: number } } = {
  default: { okrw: 500_000n, periodSec: 2_592_000 },
  demo: { okrw: 60_000n, periodSec: 3_600 },
};

export interface PolicyConfig {
  readonly profile: PolicyProfile;
  readonly perOrderLimitAokrw: { readonly [L in AgentLevel]: bigint };
  readonly periodicCapAokrw: bigint;
  readonly periodicPeriodSec: number;
  /** Global testnet KYC limits for owners without attestation (chain global policy, D-07). */
  readonly unverifiedPerTxAokrw: bigint;
  readonly unverifiedPerDayAokrw: bigint;
  /** Personal monthly budget default, server-side only (D-07). */
  readonly defaultMonthlyBudgetAokrw: bigint;
  /** Nag thresholds in basis points of the monthly budget (tech-spec 3.7). */
  readonly nagThresholdsBps: readonly [number, number, number];
  /** Approval requests expire after this (tech-spec 1.4 flow 3). */
  readonly approvalTtlMs: number;
  /**
   * Monthly budget choices (Budget.dc.html, D-21). The LLM picks only a key;
   * the server turns it into an amount.
   */
  readonly monthlyBudgetOptions: readonly MonthlyBudgetOption[];
  /** Trial allowance shown on sign-up (Budget.dc.html "체험용 용돈 100,000원", user-flow 5). */
  readonly trialAllowanceAokrw: bigint;
}

export type MonthlyBudgetOptionId = 'small' | 'medium' | 'large';

export interface MonthlyBudgetOption {
  readonly id: MonthlyBudgetOptionId;
  readonly amountAokrw: bigint;
}

export const MONTHLY_BUDGET_OPTION_IDS: readonly MonthlyBudgetOptionId[] = [
  'small',
  'medium',
  'large',
];

/**
 * Words in the user's own message that open the limit-change card (D-21).
 * This is a gate against injected text in tool results, not language
 * understanding: a miss means no card, and the dragon points to the button path.
 * No bare stems like 내리 or 올리: "비 내리는 날", "올리브" are everyday orders.
 */
export const LIMIT_INTENT_KEYWORDS: readonly string[] = [
  '한도',
  '예산',
  '올려',
  '내려',
  '늘려',
  '줄여',
  '레벨',
  '만 원',
  '만원',
];

/** True when the user's own text mentions limits (D-21). Digits followed by 원 count too. */
export function hasLimitIntent(userText: string): boolean {
  const text = userText.normalize('NFC');
  if (LIMIT_INTENT_KEYWORDS.some((k) => text.includes(k))) return true;
  return /[0-9][0-9,]*\s*원/.test(text);
}

export const POLICY_PROFILES: readonly PolicyProfile[] = ['default', 'demo'];

export function isPolicyProfile(value: string): value is PolicyProfile {
  return (POLICY_PROFILES as readonly string[]).includes(value);
}

export function getPolicy(profile: PolicyProfile): PolicyConfig {
  if (!isPolicyProfile(profile)) {
    throw new AppError('INTERNAL', { reason: 'unknown policy profile', profile: String(profile) });
  }
  const cap = PERIODIC_CAP[profile];
  return {
    profile,
    perOrderLimitAokrw: {
      1: okrwToAokrw(PER_ORDER_LIMIT_OKRW[1]),
      2: okrwToAokrw(PER_ORDER_LIMIT_OKRW[2]),
      3: okrwToAokrw(PER_ORDER_LIMIT_OKRW[3]),
    },
    periodicCapAokrw: okrwToAokrw(cap.okrw),
    periodicPeriodSec: cap.periodSec,
    unverifiedPerTxAokrw: okrwToAokrw(2_000_000n),
    unverifiedPerDayAokrw: okrwToAokrw(10_000_000n),
    defaultMonthlyBudgetAokrw: okrwToAokrw(300_000n),
    nagThresholdsBps: [7_000, 9_000, 10_000],
    approvalTtlMs: 10 * 60 * 1000,
    monthlyBudgetOptions: [
      { id: 'small', amountAokrw: okrwToAokrw(200_000n) },
      { id: 'medium', amountAokrw: okrwToAokrw(300_000n) },
      { id: 'large', amountAokrw: okrwToAokrw(500_000n) },
    ],
    trialAllowanceAokrw: okrwToAokrw(100_000n),
  };
}

/** Agent float in mode P: per-order limit times the multiplier (D-06, AGENT_FLOAT_MULTIPLIER). */
export function floatCapAokrw(policy: PolicyConfig, level: AgentLevel, multiplier: bigint): bigint {
  if (multiplier < 1n) {
    throw new AppError('INTERNAL', { reason: 'float multiplier must be at least 1' });
  }
  const cap = policy.perOrderLimitAokrw[level] * multiplier;
  if (cap > MAX_AOKRW) {
    throw new AppError('INTERNAL', { reason: 'float cap out of range' });
  }
  return cap;
}

/** Nag stages (tech-spec 3.7). One list for the type and BudgetView. */
export const NAG_STAGES = ['none', 'warn70', 'warn90', 'over100'] as const;
export type NagStage = (typeof NAG_STAGES)[number];

/** Which nag stage the month's spend has reached (tech-spec 3.7). Pure bigint math, no floats. */
export function nagStage(policy: PolicyConfig, spentAokrw: bigint, budgetAokrw: bigint): NagStage {
  if (budgetAokrw <= 0n) {
    return spentAokrw > 0n ? 'over100' : 'none';
  }
  const [warn70, warn90, over100] = policy.nagThresholdsBps;
  const scaled = spentAokrw * 10_000n;
  if (scaled >= budgetAokrw * BigInt(over100)) return 'over100';
  if (scaled >= budgetAokrw * BigInt(warn90)) return 'warn90';
  if (scaled >= budgetAokrw * BigInt(warn70)) return 'warn70';
  return 'none';
}
