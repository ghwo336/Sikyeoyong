import { z } from 'zod';
import { zAmountRangeView } from './limits.js';
import { NAG_STAGES } from '../config/policy.js';
import { zAokrwString } from '../money/money.js';

/**
 * GET /api/budget and the get_budget tool (tech-spec 3.2 BudgetView, D-21, D-31).
 * Amounts are aokrw strings. The 30-day window is the chain's: chainUsed is what this
 * agent spent in it, chainResetAtSec its end in unix seconds (null before the first order).
 * myPeriodicLimit is the owner's own 30-day limit (server-kept, at most chainCap);
 * nagLevel is chainUsed against it. limitRanges are what the owner may pick.
 */
export const zBudgetView = z
  .object({
    myPeriodicLimit: zAokrwString,
    nagLevel: z.enum(NAG_STAGES),
    chainCap: zAokrwString,
    chainUsed: zAokrwString,
    chainResetAtSec: z.number().int().nonnegative().nullable(),
    perOrderLimit: zAokrwString,
    frozen: z.boolean(),
    limitRanges: z.object({ perOrder: zAmountRangeView, myPeriodic: zAmountRangeView }).strict(),
  })
  .strict();

export type BudgetView = z.infer<typeof zBudgetView>;
