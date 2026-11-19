import { Inject, Injectable } from '@nestjs/common';
import { aokrwToString, type BudgetView, kstMonthOf, nagStage } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';
import { CHAIN_READER, type ChainReader } from '../chain/chain.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { UsersService } from '../users/users.service.js';

/**
 * Budget at a glance (tech-spec 3.2 BudgetView, 3.7). Used by GET /api/budget
 * and the get_budget tool. The personal budget is the server's; the 30-day cap
 * and its use are the chain's.
 */
@Injectable()
export class BudgetService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_READER) private readonly chain: ChainReader,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
    private readonly orders: OrdersService,
  ) {}

  async getView(userId: string, nowMs: number = Date.now()): Promise<BudgetView> {
    const policy = this.config.policy;
    const monthKst = kstMonthOf(nowMs);
    const budget = this.users.getMonthlyBudgetAokrw(userId);
    const agent = this.agents.getForUser(userId);
    const spent = this.orders.spentInMonthAokrw(userId, monthKst);
    const chain = await this.chain.periodicVolume(agent.wallet);
    return {
      monthKst,
      personalBudget: aokrwToString(budget),
      personalSpent: aokrwToString(spent),
      nagLevel: nagStage(policy, spent, budget),
      chainCap: aokrwToString(policy.periodicCapAokrw),
      chainUsed: aokrwToString(chain.usedAokrw),
      chainResetAtSec: chain.resetAtSec,
      level: agent.level,
      perOrderLimit: aokrwToString(policy.perOrderLimitAokrw[agent.level]),
      frozen: agent.frozen,
      budgetOptions: policy.monthlyBudgetOptions.map((o) => ({
        id: o.id,
        amount: aokrwToString(o.amountAokrw),
      })),
    };
  }
}
