import { Controller, Get, UseGuards } from '@nestjs/common';
import type { IdCardView, MeView, SignupConfig } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { MeService } from './me.service.js';

/** GET /api/me, GET /api/me/id-card. HTTP only. The 30-day limit moved to PUT /agents/me/limits (D-31). */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): MeView {
    return this.me.me(user.userId);
  }

  @Get('id-card')
  idCard(@CurrentUser() user: SessionUser): IdCardView {
    return this.me.idCard(user.userId);
  }
}

/** GET /api/signup/config: public, before any session exists. */
@Controller('signup')
export class SignupController {
  constructor(private readonly me: MeService) {}

  @Get('config')
  config(): SignupConfig {
    return this.me.signupConfig();
  }
}
