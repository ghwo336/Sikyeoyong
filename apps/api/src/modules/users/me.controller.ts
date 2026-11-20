import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  type MeView,
  parseAokrw,
  type PatchMeBody,
  type SignupConfig,
  type UserView,
  zPatchMeBody,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { MeService } from './me.service.js';
import { UsersService } from './users.service.js';

/** GET /api/me, PATCH /api/me. HTTP only. */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly users: UsersService,
  ) {}

  @Get()
  get(@CurrentUser() user: SessionUser): MeView {
    return this.me.me(user.userId);
  }

  @Patch()
  patch(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zPatchMeBody)) body: PatchMeBody,
  ): UserView {
    return this.users.setMonthlyBudget(user.userId, parseAokrw(body.monthlyBudgetOkrw));
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
