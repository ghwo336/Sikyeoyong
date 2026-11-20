import { AppError } from '../errors/index.js';
import { MAX_AOKRW, okrwToAokrw } from '../money/index.js';

/**
 * Policy values (decisions D-07, D-12). Amounts are written in whole OKRW for
 * readability and exposed as aokrw bigint. Ratios are basis points (1/10000)
 * so budget math stays in bigint. Changing a chain-enforced value here also
 * needs `pnpm policy:apply` (chain-and-pcl.md).
 */
export type PolicyProfile = 'default' | 'demo';

/**
 * The per-order limit the owner picks (D-31), chain-enforced via 8004 TransferLimit.
 * Same for every profile. `initial` is what Hatch writes before the owner picks.
 */
const PER_ORDER_LIMIT_OKRW = { min: 5_000n, max: 50_000n, step: 5_000n, initial: 10_000n };

/**
 * The owner's own 30-day limit (D-31, the old monthly budget). The server keeps it, inside
 * the chain's shared cap (its max). The demo starts at the chain cap so scene 14 is a chain revert.
 */
const MY_PERIODIC_OKRW: {
  readonly [P in PolicyProfile]: { min: bigint; step: bigint; initial: bigint };
} = {
  default: { min: 50_000n, step: 50_000n, initial: 300_000n },
  demo: { min: 10_000n, step: 10_000n, initial: 60_000n },
};

/** Dragon growth by the per-order limit (D-31): up to 10,000 stage 1, up to 30,000 stage 2. */
const DRAGON_STAGE_MAX_OKRW = { 1: 10_000n, 2: 30_000n } as const;
export type DragonStage = 1 | 2 | 3;

/** A limit the owner can pick: from min to max in steps (aokrw). */
export interface AmountRange {
  readonly minAokrw: bigint;
  readonly maxAokrw: bigint;
  readonly stepAokrw: bigint;
  readonly initialAokrw: bigint;
}

/** 30-day cap, chain-enforced via PERIODIC_VOLUME_POLICY on placeOrder (D-07, D-12). */
const PERIODIC_CAP: { readonly [P in PolicyProfile]: { okrw: bigint; periodSec: number } } = {
  default: { okrw: 500_000n, periodSec: 2_592_000 },
  demo: { okrw: 60_000n, periodSec: 3_600 },
};

export interface PolicyConfig {
  readonly profile: PolicyProfile;
  /** The per-order limit range (D-31). */
  readonly perOrderLimit: AmountRange;
  /** The owner's own 30-day limit range, max = periodicCapAokrw (D-31). */
  readonly myPeriodicLimit: AmountRange;
  readonly periodicCapAokrw: bigint;
  readonly periodicPeriodSec: number;
  /** Global testnet KYC limits for owners without attestation (chain global policy, D-07). */
  readonly unverifiedPerTxAokrw: bigint;
  readonly unverifiedPerDayAokrw: bigint;
  /** Nag thresholds in basis points of the owner's 30-day limit (tech-spec 3.7, D-31). */
  readonly nagThresholdsBps: readonly [number, number, number];
  /** Approval requests expire after this (tech-spec 1.4 flow 3). */
  readonly approvalTtlMs: number;
  /** Trial allowance shown on sign-up (Budget.dc.html "체험용 용돈 100,000원", user-flow 5). */
  readonly trialAllowanceAokrw: bigint;
}

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
  const mine = MY_PERIODIC_OKRW[profile];
  return {
    profile,
    perOrderLimit: {
      minAokrw: okrwToAokrw(PER_ORDER_LIMIT_OKRW.min),
      maxAokrw: okrwToAokrw(PER_ORDER_LIMIT_OKRW.max),
      stepAokrw: okrwToAokrw(PER_ORDER_LIMIT_OKRW.step),
      initialAokrw: okrwToAokrw(PER_ORDER_LIMIT_OKRW.initial),
    },
    myPeriodicLimit: {
      minAokrw: okrwToAokrw(mine.min),
      maxAokrw: okrwToAokrw(cap.okrw),
      stepAokrw: okrwToAokrw(mine.step),
      initialAokrw: okrwToAokrw(mine.initial),
    },
    periodicCapAokrw: okrwToAokrw(cap.okrw),
    periodicPeriodSec: cap.periodSec,
    unverifiedPerTxAokrw: okrwToAokrw(2_000_000n),
    unverifiedPerDayAokrw: okrwToAokrw(10_000_000n),
    nagThresholdsBps: [7_000, 9_000, 10_000],
    approvalTtlMs: 10 * 60 * 1000,
    trialAllowanceAokrw: okrwToAokrw(100_000n),
  };
}

/** True when the owner may pick this amount: inside the range and on a step (D-31). */
export function isInRange(range: AmountRange, aokrw: bigint): boolean {
  return (
    aokrw >= range.minAokrw &&
    aokrw <= range.maxAokrw &&
    (aokrw - range.minAokrw) % range.stepAokrw === 0n
  );
}

/**
 * The smallest per-order limit that lets this order through (Blocked: "한 번에 N원으로 올리고
 * 시키기"), or null when even the top of the range is too small.
 */
export function perOrderLimitToFit(policy: PolicyConfig, amountAokrw: bigint): bigint | null {
  const r = policy.perOrderLimit;
  if (amountAokrw > r.maxAokrw) return null;
  if (amountAokrw <= r.minAokrw) return r.minAokrw;
  const over = amountAokrw - r.minAokrw;
  const steps = (over + r.stepAokrw - 1n) / r.stepAokrw;
  return r.minAokrw + steps * r.stepAokrw;
}

/** How grown the dragon looks for a per-order limit (D-31). Display only. */
export function dragonStage(perOrderLimitAokrw: bigint): DragonStage {
  if (perOrderLimitAokrw <= okrwToAokrw(DRAGON_STAGE_MAX_OKRW[1])) return 1;
  if (perOrderLimitAokrw <= okrwToAokrw(DRAGON_STAGE_MAX_OKRW[2])) return 2;
  return 3;
}

/** Agent float in mode P: per-order limit times the multiplier (D-06, AGENT_FLOAT_MULTIPLIER). */
export function floatCapAokrw(perOrderLimitAokrw: bigint, multiplier: bigint): bigint {
  if (multiplier < 1n) {
    throw new AppError('INTERNAL', { reason: 'float multiplier must be at least 1' });
  }
  const cap = perOrderLimitAokrw * multiplier;
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
