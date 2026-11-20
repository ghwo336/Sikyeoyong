import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { IdentityStatus } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { IdentityService } from './identity.service.js';

/** GET /api/identity and POST /api/identity/verify (user-flow 2, D-16). HTTP only: the user is the session's. */
@Controller('identity')
@UseGuards(SessionGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  /** The front door asks: a signed-in owner without a dragon goes to Verify or to Name. */
  @Get()
  status(@CurrentUser() user: SessionUser): IdentityStatus {
    return { verified: this.identity.isVerified(user.userId) };
  }

  @Post('verify')
  @HttpCode(200)
  verify(@CurrentUser() user: SessionUser): { verified: true } {
    return this.identity.verify(user.userId);
  }
}
