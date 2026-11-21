import { type BudgetView, parseAokrw, type SetLimitsBody } from '@sikyeoyong/shared';
import { type Range, thirtyDayFloor } from './fit';

/** What the owner has picked on the two steppers so far (undefined = still the saved value). */
export interface LimitPicks {
  readonly perOrder?: bigint | undefined;
  readonly myPeriodic?: bigint | undefined;
}

/** The two limits as the steppers show them, with the ranges they move in (aokrw). */
export interface LimitDraft {
  readonly perOrder: bigint;
  readonly myPeriodic: bigint;
  readonly perOrderRange: Range;
  /** The 30-day stepper's range: its minimum is the floor the per-order value sets (D-31). */
  readonly periodicRange: Range;
}

const rangeOf = (r: { min: string; max: string; step: string }): Range => ({
  min: parseAokrw(r.min),
  max: parseAokrw(r.max),
  step: parseAokrw(r.step),
});

/**
 * Budget.dc.html and the wallet's limit screen share this (D-31): the 30-day amount never sits
 * under the per-order one. Raising per-order above it carries it up, and its stepper cannot go
 * below it.
 */
export function limitDraft(budget: BudgetView, picks: LimitPicks): LimitDraft {
  const perOrderRange = rangeOf(budget.limitRanges.perOrder);
  const myRange = rangeOf(budget.limitRanges.myPeriodic);
  const perOrder = picks.perOrder ?? parseAokrw(budget.perOrderLimit);
  const floor = thirtyDayFloor(perOrder, myRange);
  const picked = picks.myPeriodic ?? parseAokrw(budget.myPeriodicLimit);
  return {
    perOrder,
    myPeriodic: picked < floor ? floor : picked,
    perOrderRange,
    periodicRange: { ...myRange, min: floor },
  };
}

/** Only what changed, as the server takes it (empty when nothing changed). */
export function limitsBody(budget: BudgetView, draft: LimitDraft): SetLimitsBody {
  return {
    ...(draft.perOrder === parseAokrw(budget.perOrderLimit)
      ? {}
      : { perOrderLimit: draft.perOrder.toString() }),
    ...(draft.myPeriodic === parseAokrw(budget.myPeriodicLimit)
      ? {}
      : { myPeriodicLimit: draft.myPeriodic.toString() }),
  };
}

/** Whether the change raises either limit, which needs the re-auth step (D-28). */
export function raisesLimit(budget: BudgetView, draft: LimitDraft): boolean {
  return (
    draft.perOrder > parseAokrw(budget.perOrderLimit) ||
    draft.myPeriodic > parseAokrw(budget.myPeriodicLimit)
  );
}
