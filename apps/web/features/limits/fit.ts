import { getPolicy, parseAokrw, perOrderLimitToFit } from '@sikyeoyong/shared';

/**
 * The smallest per-order limit that lets this order through (Blocked.dc.html "한 번에 N원으로
 * 올리고 시키기", D-31), or undefined above the top of the range. The per-order range is the same
 * in every profile (policy.test.ts), so the default profile answers for the demo too.
 */
export function limitToFit(amount: bigint): bigint | undefined {
  return perOrderLimitToFit(getPolicy('default'), amount) ?? undefined;
}

/** The limits a recommendation is checked against (BudgetView fields, aokrw strings). */
export interface LimitsNow {
  readonly perOrderLimit: string;
  readonly myPeriodicLimit: string;
  readonly chainCap: string;
  readonly chainUsed: string;
}

/**
 * Whether a menu at this price asks the owner now, by the server's recommendation rule
 * (recommend/score.ts): over the per-order limit, or over my 30-day limit while that is below
 * the shared cap. The chat redraws its old cards with it, so a card that said 허락 필요 clears
 * after a raise (and a lowered limit marks it again).
 */
export function needsApprovalNow(price: bigint, limits: LimitsNow): boolean {
  if (price > parseAokrw(limits.perOrderLimit)) return true;
  const mine = parseAokrw(limits.myPeriodicLimit);
  return mine < parseAokrw(limits.chainCap) && parseAokrw(limits.chainUsed) + price > mine;
}

/** A limit range as aokrw (BudgetView limitRanges, parsed). */
export interface Range {
  readonly min: bigint;
  readonly max: bigint;
  readonly step: bigint;
}

/**
 * The lowest 30-day limit the owner may pick with this per-order limit (D-31: one order never
 * more than the 30 days allow): the smallest step of the range at or above it, at most the top.
 */
export function thirtyDayFloor(perOrder: bigint, range: Range): bigint {
  if (perOrder <= range.min) return range.min;
  const steps = (perOrder - range.min + range.step - 1n) / range.step;
  const floor = range.min + steps * range.step;
  return floor > range.max ? range.max : floor;
}
