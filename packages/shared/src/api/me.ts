import { z } from 'zod';
import { zAgentLevel } from './level.js';
import { zDragonSpecies } from '../domain/dragon.js';
import { zAokrwString } from '../money/money.js';

/**
 * GET /me (tech-spec 3.2): the dragon at a glance for the chat top bar. Budget numbers
 * come from GET /budget. Before the dragon exists GET /me answers NOT_FOUND and the web
 * goes to naming.
 */
export const zMeView = z
  .object({
    dragonName: z.string().min(1).max(8),
    dragonSpecies: zDragonSpecies,
    level: zAgentLevel,
    perOrderLimit: zAokrwString,
  })
  .strict();
export type MeView = z.infer<typeof zMeView>;

/**
 * PATCH /me body (tech-spec 3.2). Only the monthly budget for now; the server
 * accepts only one of the policy options (D-21), never a free amount.
 */
export const zPatchMeBody = z.object({ monthlyBudgetOkrw: zAokrwString }).strict();
export type PatchMeBody = z.infer<typeof zPatchMeBody>;

/** PATCH /me answer. */
export const zUserView = z
  .object({ user: z.object({ nickname: z.string(), monthlyBudget: zAokrwString }).strict() })
  .strict();
export type UserView = z.infer<typeof zUserView>;

/** GET /signup/config (tech-spec 3.2). The identity step is a server setting (D-16). */
export const zSignupConfig = z
  .object({ verifyMode: z.enum(['kakao', 'mock']), trialAllowance: zAokrwString })
  .strict();
export type SignupConfig = z.infer<typeof zSignupConfig>;

export const AGENT_SETUP_STEP_KEYS = ['wallet', 'identity', 'limit'] as const;

/**
 * GET /agents/me (tech-spec 3.2): the hatch status and its three setup steps in order
 * (user-flow 4). Wallet and chain detail for the wallet screens join as optional fields later.
 */
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
