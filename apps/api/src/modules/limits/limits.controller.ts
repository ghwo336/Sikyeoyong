import { Body, Controller, HttpCode, Put, UseGuards } from '@nestjs/common';
import { type SetLimitsBody, type SetLimitsResult, zSetLimitsBody } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { LimitsService } from './limits.service.js';

/** PUT /api/agents/me/limits (D-31). HTTP only: the owner comes from the session. */
@Controller('agents')
@UseGuards(SessionGuard)
export class LimitsController {
  constructor(private readonly limits: LimitsService) {}

  /** The owner's limits button. Raising waits for re-auth unless REAUTH_MODE=none (D-28). */
  @Put('me/limits')
  @HttpCode(200)
  set(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zSetLimitsBody)) body: SetLimitsBody,
  ): Promise<SetLimitsResult> {
    return this.limits.setLimits(user.userId, body);
  }
}
