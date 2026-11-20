import { z } from 'zod';
import { zAokrwString } from '../money/money.js';

/** A limit range the owner picks from (D-31): min to max in steps, aokrw strings. */
export const zAmountRangeView = z
  .object({ min: zAokrwString, max: zAokrwString, step: zAokrwString })
  .strict();
export type AmountRangeView = z.infer<typeof zAmountRangeView>;

/**
 * PUT /agents/me/limits body (D-31, tech-spec 3.2): the owner's button only, never an LLM tool.
 * Either or both: the per-order limit (written to the chain) and the owner's 30-day limit
 * (kept by the server). Amounts are aokrw strings; the server checks range and step.
 */
export const zSetLimitsBody = z
  .object({ perOrderLimit: zAokrwString.optional(), myPeriodicLimit: zAokrwString.optional() })
  .strict()
  .refine((b) => b.perOrderLimit !== undefined || b.myPeriodicLimit !== undefined, {
    message: 'perOrderLimit or myPeriodicLimit',
  });
export type SetLimitsBody = z.infer<typeof zSetLimitsBody>;

/** PUT /agents/me/limits answer: both limits now and the chain transaction for the per-order one. */
export const zSetLimitsResult = z
  .object({
    perOrderLimit: zAokrwString,
    myPeriodicLimit: zAokrwString,
    txHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .nullable(),
  })
  .strict();
export type SetLimitsResult = z.infer<typeof zSetLimitsResult>;
