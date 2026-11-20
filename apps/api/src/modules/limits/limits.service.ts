import { Inject, Injectable } from '@nestjs/common';
import {
  type AmountRange,
  AppError,
  aokrwToString,
  isInRange,
  parseAokrw,
  type SetLimitsBody,
  type SetLimitsResult,
} from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentLimitService } from '../agents/agent-limit.service.js';
import { AgentLock } from '../agents/agent-lock.service.js';
import { UsersService } from '../users/users.service.js';

/**
 * PUT /agents/me/limits (D-31, D-28): the owner's button, never an LLM tool (CLAUDE.md 3).
 * Two amounts, either or both:
 * - perOrderLimit, kept by the chain: the 8004 TransferLimit is written first (AgentLimitService),
 *   then the stored amount. Its tx hash is the answer's txHash.
 * - myPeriodicLimit, the owner's own 30-day limit, kept by the server only (no chain write).
 * Each must be in its policy range and on a step, else VALIDATION_FAILED and nothing changes.
 * Lowering is immediate. Raising either needs re-auth: with REAUTH_MODE=none (testnet demo,
 * refused in production) the button is enough; with pouch the owner's wallet must sign, not
 * wired before the Pouch SDK (Q-30), so a raise is refused before anything is written.
 * A value equal to the current one is a no-op. The per-order write goes first, so a failed
 * chain call leaves both limits as they were. One owner action per dragon at a time (AgentLock).
 */
@Injectable()
export class LimitsService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly agents: AgentLimitService,
    private readonly lock: AgentLock,
    private readonly users: UsersService,
  ) {}

  setLimits(
    userId: string,
    body: SetLimitsBody,
    nowMs: number = Date.now(),
  ): Promise<SetLimitsResult> {
    const policy = this.config.policy;
    const perOrder = picked(body.perOrderLimit, policy.perOrderLimit, 'perOrderLimit');
    const myPeriodic = picked(body.myPeriodicLimit, policy.myPeriodicLimit, 'myPeriodicLimit');
    return this.lock.run(this.agents.find(userId).id, async () => {
      const agent = this.agents.find(userId);
      const currentMine = this.users.getMyPeriodicLimitAokrw(userId);
      const changePerOrder = perOrder !== null && perOrder !== agent.perOrderLimitAokrw;
      const changeMine = myPeriodic !== null && myPeriodic !== currentMine;
      const raises =
        (changePerOrder && perOrder > agent.perOrderLimitAokrw) ||
        (changeMine && myPeriodic > currentMine);
      if (raises && this.config.reauthMode !== 'none') {
        throw new AppError('INTERNAL', {
          reason: 're-auth by the owner wallet is not wired yet (Q-30)',
        });
      }
      const txHash = changePerOrder ? await this.agents.write(userId, perOrder, nowMs) : null;
      if (changeMine) this.users.setMyPeriodicLimit(userId, myPeriodic);
      return {
        perOrderLimit: aokrwToString(changePerOrder ? perOrder : agent.perOrderLimitAokrw),
        myPeriodicLimit: aokrwToString(changeMine ? myPeriodic : currentMine),
        txHash,
      };
    });
  }
}

/** The asked amount, or null when not asked. Out of range or off step is VALIDATION_FAILED. */
function picked(value: string | undefined, range: AmountRange, path: string): bigint | null {
  if (value === undefined) return null;
  const aokrw = parseAokrw(value);
  if (!isInRange(range, aokrw)) {
    throw new AppError('VALIDATION_FAILED', {
      public: { issues: [{ path, message: 'out of range or off step' }] },
    });
  }
  return aokrw;
}
