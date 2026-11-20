import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { IdentityRepository } from './identity.repository.js';

/**
 * The owner's identity check (D-16): sign-up needs it, and no dragon hatches without
 * it. VERIFY_MODE=mock is the trial check (a button that passes); kakao waits for
 * the Kakao check to be reachable from the app (Q-19) and refuses until then.
 * Other modules ask only through this service.
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly repo: IdentityRepository,
  ) {}

  verify(userId: string, nowMs: number = Date.now()): { verified: true } {
    if (this.config.verifyMode !== 'mock') {
      throw new AppError('INTERNAL', { reason: 'kakao identity check is not wired yet (Q-19)' });
    }
    this.repo.record(userId, 'mock', nowMs);
    return { verified: true };
  }

  isVerified(userId: string): boolean {
    return this.repo.isVerified(userId);
  }
}
