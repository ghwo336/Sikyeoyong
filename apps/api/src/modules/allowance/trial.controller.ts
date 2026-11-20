import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { TrialResult } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { TrialService } from './trial.service.js';

/** POST /api/signup/trial (user-flow 5). The rules live in TrialService. */
@Controller('signup')
@UseGuards(SessionGuard)
export class TrialController {
  constructor(private readonly trial: TrialService) {}

  @Post('trial')
  @HttpCode(200)
  claim(@CurrentUser() user: SessionUser): TrialResult {
    return this.trial.claim(user.userId);
  }
}
