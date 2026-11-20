import { Inject, Injectable } from '@nestjs/common';
import { aokrwToString, type MeView, type SignupConfig } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';

/**
 * GET /me and GET /signup/config (tech-spec 3.2). /me is the dragon at a glance;
 * before the dragon exists it is NOT_FOUND and the web goes to naming.
 */
@Injectable()
export class MeService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly agents: AgentsService,
  ) {}

  me(userId: string): MeView {
    const agent = this.agents.getForUser(userId);
    return {
      dragonName: agent.dragonName,
      dragonSpecies: agent.dragonSpecies,
      level: agent.level,
      perOrderLimit: aokrwToString(this.config.policy.perOrderLimitAokrw[agent.level]),
    };
  }

  signupConfig(): SignupConfig {
    return {
      verifyMode: this.config.verifyMode,
      trialAllowance: aokrwToString(this.config.policy.trialAllowanceAokrw),
    };
  }
}
