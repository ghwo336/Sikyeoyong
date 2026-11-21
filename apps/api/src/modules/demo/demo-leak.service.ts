import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  aokrwToString,
  floatCapAokrw,
  type LeakCompareView,
  type PaymentProvider,
} from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';

/**
 * The key leak comparison's numbers (demo scene 5, tech-spec 9.3). Reads only, and only while
 * DEMO_MODE is on: when it is off the answer is NOT_FOUND, as if the route did not exist.
 * The words of rule 11 live in the screen; here are only the numbers.
 */
@Injectable()
export class DemoLeakService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly agents: AgentsService,
  ) {}

  async getView(userId: string): Promise<LeakCompareView> {
    if (!this.config.demo.enabled) throw new AppError('NOT_FOUND', { reason: 'not found' });
    const agent = this.agents.getForUser(userId);
    const pocket = agent.wallet === null ? 0n : await this.payment.balanceOf(agent.wallet);
    const { floatMultiplier, gasShareAokrw } = this.config.payment;
    const { policy } = this.config;
    const float = floatCapAokrw(agent.perOrderLimitAokrw, floatMultiplier) + gasShareAokrw;
    return {
      perOrderLimit: aokrwToString(agent.perOrderLimitAokrw),
      periodicCap: aokrwToString(policy.periodicCapAokrw),
      periodicPeriodSec: policy.periodicPeriodSec,
      floatAtRisk: aokrwToString(float),
      pocket: aokrwToString(pocket),
    };
  }
}
