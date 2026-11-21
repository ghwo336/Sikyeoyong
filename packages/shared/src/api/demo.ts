import { z } from 'zod';
import { zAokrwString } from '../money/money.js';

/**
 * GET /demo/leak-compare (DEMO_MODE only, demo scene 5, tech-spec 9.3, LeakCompare.dc.html):
 * the numbers a thief with the dragon's key could reach. Every amount is aokrw.
 * - perOrderLimit: the owner's per-order limit; a bigger order through the order contract is refused.
 * - periodicCap and periodicPeriodSec: the shared 30-day cap on orders (the chain's, D-07).
 * - floatAtRisk: the most the dragon's wallet is kept at, per-order limit times the multiplier plus
 *   the gas share (D-06, D-25). The bypass path can lose this much and no more.
 * - pocket: what the dragon's wallet holds now.
 */
export const zLeakCompareView = z
  .object({
    perOrderLimit: zAokrwString,
    periodicCap: zAokrwString,
    periodicPeriodSec: z.number().int().positive(),
    floatAtRisk: zAokrwString,
    pocket: zAokrwString,
  })
  .strict();
export type LeakCompareView = z.infer<typeof zLeakCompareView>;
