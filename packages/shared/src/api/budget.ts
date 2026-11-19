import { z } from 'zod';
import { zAgentLevel } from './level.js';
import { MONTHLY_BUDGET_OPTION_IDS, NAG_STAGES } from '../config/policy.js';
import { zAokrwString } from '../money/money.js';

/**
 * GET /api/budget and the get_budget tool (tech-spec 3.2 BudgetView, D-21).
 * Amounts are aokrw strings. chainResetAtSec is unix seconds from the chain
 * (null before the first order in the window); monthKst is the calendar month in KST.
 */
export const zBudgetView = z
  .object({
    monthKst: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    personalBudget: zAokrwString,
    personalSpent: zAokrwString,
    nagLevel: z.enum(NAG_STAGES),
    chainCap: zAokrwString,
    chainUsed: zAokrwString,
    chainResetAtSec: z.number().int().nonnegative().nullable(),
    level: zAgentLevel,
    perOrderLimit: zAokrwString,
    frozen: z.boolean(),
    budgetOptions: z.array(
      z.object({ id: z.enum(MONTHLY_BUDGET_OPTION_IDS), amount: zAokrwString }).strict(),
    ),
  })
  .strict();

export type BudgetView = z.infer<typeof zBudgetView>;
