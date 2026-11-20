import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { IdentityService } from './identity.service.js';

/** POST /api/identity/verify (user-flow 2, D-16). HTTP only: the user is the session's. */
@Controller('identity')
@UseGuards(SessionGuard)
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('verify')
  @HttpCode(200)
  verify(@CurrentUser() user: SessionUser): { verified: true } {
    return this.identity.verify(user.userId);
  }
}
