import { z } from 'zod';
import { AGENT_LEVELS } from '../config/policy.js';
import { zDragonSpecies } from '../domain/dragon.js';
import { zAokrwString } from '../money/money.js';

const zLevel = z.union(
  AGENT_LEVELS.map((l) => z.literal(l)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>],
);

/** GET /me, the fields screens read. perOrderLimit is the limit of the current level. */
export const zMeView = z
  .object({
    dragonName: z.string().min(1).max(8),
    dragonSpecies: zDragonSpecies,
    level: zLevel,
    perOrderLimit: zAokrwString,
  })
  .strict();
export type MeView = z.infer<typeof zMeView>;

/** Sign-up settings (D-16: the identity step is a server setting). */
export const zSignupConfig = z
  .object({ verifyMode: z.enum(['kakao', 'mock']), trialAllowance: zAokrwString })
  .strict();
export type SignupConfig = z.infer<typeof zSignupConfig>;

export const AGENT_SETUP_STEP_KEYS = ['wallet', 'identity', 'limit'] as const;

/** GET /agents/me while hatching: the three setup steps in order (user-flow 4). */
export const zAgentSetupView = z
  .object({
    status: z.enum(['PENDING', 'ACTIVE', 'FAILED']),
    steps: z
      .array(
        z
          .object({
            key: z.enum(AGENT_SETUP_STEP_KEYS),
            status: z.enum(['done', 'doing', 'waiting', 'failed']),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export type AgentSetupView = z.infer<typeof zAgentSetupView>;

/** POST /agents body. Species is decoration only (D-20). */
export const zCreateAgentBody = z
  .object({ dragonName: z.string().trim().min(1).max(8), dragonSpecies: zDragonSpecies })
  .strict();
export type CreateAgentBody = z.infer<typeof zCreateAgentBody>;
