import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  type PouchiBindBody,
  type PouchiCompleteBody,
  type PouchiLoginConfig,
  zPouchiBindBody,
  zPouchiCompleteBody,
} from '@sikyeoyong/shared';
import type { Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import { CsrfHeaderGuard } from '../../common/guards/csrf-header.guard.js';
import {
  SESSION_COOKIE,
  sessionCookieFrom,
  sessionCookieOptions,
} from '../../common/guards/session.guard.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { PouchiService } from '../pouchi/pouchi.service.js';
import { PouchiLoginService } from './pouchi-login.service.js';

/**
 * D-29 the only login: GET /api/auth/pouchi/config (public), POST /api/auth/pouchi/bind and
 * /complete (before any session, so the CSRF header guard instead of the session guard).
 * The services check the result; this sets the session cookie (HTTP plumbing only).
 */
@Controller('auth/pouchi')
export class PouchiLoginController {
  constructor(
    private readonly pouchi: PouchiService,
    private readonly login: PouchiLoginService,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  @Get('config')
  config(): PouchiLoginConfig {
    return this.pouchi.loginConfig();
  }

  @Post('bind')
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(204)
  bind(
    @Body(new ZodValidationPipe(zPouchiBindBody)) body: PouchiBindBody,
    @Req() req: Request,
  ): void {
    this.pouchi.bind(body.requestId, body.codeChallenge, req.ip ?? 'unknown');
  }

  @Post('complete')
  @UseGuards(CsrfHeaderGuard)
  @HttpCode(204)
  complete(
    @Body(new ZodValidationPipe(zPouchiCompleteBody)) body: PouchiCompleteBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.login.complete(body, sessionCookieFrom(req), req.ip ?? 'unknown').then((token) => {
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.appConfig.nodeEnv));
    });
  }
}
