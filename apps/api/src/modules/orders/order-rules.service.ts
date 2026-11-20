import { Inject, Injectable } from '@nestjs/common';
import { AppError, type AppErrorCode, formatKstDateTime, kstMonthOf } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import type { AgentSummary } from '../agents/agents.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { CHAIN_READER, type ChainReader } from '../chain/chain.service.js';
import { UsersService } from '../users/users.service.js';
import { OrdersRepository } from './orders.repository.js';
import { OrderSpend, SPENT_STATUSES } from './order-spend.service.js';

/**
 * The server's own order rules, checked by the quote and again by confirm
 * (tech-spec 1.4 flows 1 and 3). The chain checks its limits again on pay;
 * these exist so the user is asked before gas is spent (server-api.md).
 */
@Injectable()
export class OrderRules {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_READER) private readonly chain: ChainReader,
    private readonly repo: OrdersRepository,
    private readonly spend: OrderSpend,
    private readonly users: UsersService,
    private readonly approvals: ApprovalsService,
  ) {}

  /**
   * The chain's 30-day cap cannot be approved away: throws CHAIN_PERIODIC_LIMIT
   * with when it opens again. Exactly the cap passes. Returns the volume used so far.
   */
  async periodUsedOrRefuse(agent: AgentSummary, amount: bigint, nowMs: number): Promise<bigint> {
    const policy = this.config.policy;
    const volume = await this.chain.periodicVolume(agent.wallet);
    if (volume.usedAokrw + amount > policy.periodicCapAokrw) {
      const resetMs =
        volume.resetAtSec === null
          ? nowMs + policy.periodicPeriodSec * 1000
          : volume.resetAtSec * 1000;
      throw new AppError('CHAIN_PERIODIC_LIMIT', {
        reason: '30-day cap',
        dragonParams: { resetAt: formatKstDateTime(resetMs) },
      });
    }
    return volume.usedAokrw;
  }

  /**
   * Rules that ask the owner, first match wins: over the level's per-order limit,
   * a store the owner has not allowed and never paid at (D-07, Q-35), then over the
   * personal monthly budget with this order (exactly the budget passes).
   * budgetApproved: the owner already said yes to going over the budget for exactly
   * this amount on this order (payment.md "승인된 사유는 다시 막지 않는다").
   */
  approvalNeeded(
    userId: string,
    agent: AgentSummary,
    merchantId: string,
    amount: bigint,
    nowMs: number,
    budgetApproved = false,
  ): AppErrorCode | null {
    const policy = this.config.policy;
    if (amount > policy.perOrderLimitAokrw[agent.level]) return 'SERVER_OVER_LEVEL';
    const seen =
      this.approvals.isMerchantAllowed(userId, merchantId) ||
      this.repo.hasOrderAt(userId, merchantId, SPENT_STATUSES);
    if (!seen) return 'SERVER_NEW_MERCHANT';
    if (budgetApproved) return null;
    const spent = this.spend.spentInMonthAokrw(userId, kstMonthOf(nowMs));
    if (spent + amount > this.users.getMonthlyBudgetAokrw(userId)) return 'SERVER_BUDGET_OVER';
    return null;
  }
}
