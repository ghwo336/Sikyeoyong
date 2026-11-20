import { Inject, Injectable } from '@nestjs/common';
import { aokrwToString, type IdCardView, type MeView, type SignupConfig } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';
import { IdentityService } from '../identity/identity.service.js';
import { UsersService } from './users.service.js';

/**
 * GET /me and GET /signup/config (tech-spec 3.2). /me is the dragon at a glance;
 * before the dragon exists it is NOT_FOUND and the web goes to naming.
 */
@Injectable()
export class MeService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly agents: AgentsService,
    private readonly identity: IdentityService,
    private readonly users: UsersService,
  ) {}

  me(userId: string): MeView {
    const agent = this.agents.getForUser(userId);
    return {
      dragonName: agent.dragonName,
      dragonSpecies: agent.dragonSpecies,
      level: agent.level,
      perOrderLimit: aokrwToString(this.config.policy.perOrderLimitAokrw[agent.level]),
      custodial: this.config.payment.ownerMode === 'custodial',
    };
  }

  /**
   * GET /me/id-card (IdCard.dc.html): the owner's name (nickname, no real name is kept, D-16),
   * whether the owner passed the identity check, and when the dragon was asked for.
   */
  idCard(userId: string): IdCardView {
    const agent = this.agents.getForUser(userId);
    return {
      ownerName: this.users.getNickname(userId).slice(0, 32),
      ownerVerified: this.identity.isVerified(userId),
      bornAt: agent.bornAt,
    };
  }

  signupConfig(): SignupConfig {
    return {
      verifyMode: this.config.verifyMode,
      trialAllowance: aokrwToString(this.config.policy.trialAllowanceAokrw),
    };
  }
}
