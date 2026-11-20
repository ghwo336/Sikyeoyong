import { Inject, Injectable } from '@nestjs/common';
import {
  type AmountRange,
  type AmountRangeView,
  aokrwToString,
  type BudgetView,
  nagStage,
} from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';
import { CHAIN_READER, type ChainReader } from '../chain/chain.service.js';
import { UsersService } from '../users/users.service.js';

/**
 * Limits at a glance (tech-spec 3.2 BudgetView, 3.7, D-31). Used by GET /api/budget and the
 * get_budget tool. The per-order limit and the 30-day cap and its use are the chain's; the
 * owner's own 30-day limit is the server's, and the nag compares the chain's 30-day use with
 * it (the same window the order check uses, never a calendar month).
 */
@Injectable()
export class BudgetService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_READER) private readonly chain: ChainReader,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
  ) {}

  async getView(userId: string): Promise<BudgetView> {
    const policy = this.config.policy;
    const mine = this.users.getMyPeriodicLimitAokrw(userId);
    const agent = this.agents.getForUser(userId);
    const chain = await this.chain.periodicVolume(agent.wallet);
    return {
      myPeriodicLimit: aokrwToString(mine),
      nagLevel: nagStage(policy, chain.usedAokrw, mine),
      chainCap: aokrwToString(policy.periodicCapAokrw),
      chainUsed: aokrwToString(chain.usedAokrw),
      chainResetAtSec: chain.resetAtSec,
      perOrderLimit: aokrwToString(agent.perOrderLimitAokrw),
      frozen: agent.frozen,
      limitRanges: {
        perOrder: rangeView(policy.perOrderLimit),
        myPeriodic: rangeView(policy.myPeriodicLimit),
      },
    };
  }
}

function rangeView(r: AmountRange): AmountRangeView {
  return {
    min: aokrwToString(r.minAokrw),
    max: aokrwToString(r.maxAokrw),
    step: aokrwToString(r.stepAokrw),
  };
}
