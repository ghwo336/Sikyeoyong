import { z } from 'zod';
import { AGENT_LEVELS } from '../config/policy.js';
import { zAokrwString } from '../money/money.js';

/** Agent level 1 to 3 (D-07), one schema for every API shape that carries a level. */
export const zAgentLevel = z.union(
  AGENT_LEVELS.map((l) => z.literal(l)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>],
);

/** POST /agents/me/level body (tech-spec 3.2, D-21, D-28). The owner's button only, never an LLM tool. */
export const zSetLevelBody = z.object({ level: zAgentLevel }).strict();
export type SetLevelBody = z.infer<typeof zSetLevelBody>;

/** POST /agents/me/level answer: the level now and the chain transaction that wrote its limit. */
export const zSetLevelResult = z
  .object({
    level: zAgentLevel,
    perOrderLimit: zAokrwString,
    txHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .nullable(),
  })
  .strict();
export type SetLevelResult = z.infer<typeof zSetLevelResult>;
