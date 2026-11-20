import { Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { AllowanceService } from './allowance.service.js';

/**
 * POST /api/signup/trial (user-flow 5, Budget.dc.html "체험용 용돈 받기"). Once per user:
 * a second call is 200 with granted false, never a second allowance. While custodial (D-24)
 * this only records the user's share of operator-held money; nothing moves on chain.
 */
@Controller('signup')
@UseGuards(SessionGuard)
export class TrialController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly allowance: AllowanceService,
  ) {}

  @Post('trial')
  @HttpCode(200)
  claim(@CurrentUser() user: SessionUser): { granted: boolean } {
    return {
      granted: this.allowance.record(
        user.userId,
        'trial',
        this.config.policy.trialAllowanceAokrw,
        null,
      ),
    };
  }
}
