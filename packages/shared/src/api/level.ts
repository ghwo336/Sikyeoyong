import { z } from 'zod';
import { AGENT_LEVELS } from '../config/policy.js';

/** Agent level 1 to 3 (D-07), one schema for every API shape that carries a level. */
export const zAgentLevel = z.union(
  AGENT_LEVELS.map((l) => z.literal(l)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>],
);
