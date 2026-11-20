import { Inject, Injectable } from '@nestjs/common';
import { AppError, type TrialResult } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { IdentityService } from '../identity/identity.service.js';
import { AllowanceService } from './allowance.service.js';

/**
 * The sign-up trial allowance (user-flow 5, Budget.dc.html "체험용 용돈 받기"). Once per user:
 * a second claim is granted false, never a second allowance. Only an owner who passed the
 * identity check gets it (user-flow 2 before 5, D-16). While custodial (D-24) this only records
 * the user's share of operator-held money; nothing moves on chain.
 */
@Injectable()
export class TrialService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly allowance: AllowanceService,
    private readonly identity: IdentityService,
  ) {}

  claim(userId: string, nowMs: number = Date.now()): TrialResult {
    if (!this.identity.isVerified(userId)) {
      throw new AppError('FORBIDDEN', {
        reason: 'identity check needed before the trial allowance',
      });
    }
    const granted = this.allowance.record(
      userId,
      'trial',
      this.config.policy.trialAllowanceAokrw,
      null,
      nowMs,
    );
    return { granted };
  }
}
