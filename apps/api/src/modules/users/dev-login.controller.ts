import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { credentialFrom, SESSION_COOKIE } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AuthService, SESSION_TTL_MS } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';

/**
 * POST /api/auth/dev-login: a session cookie without OAuth, for running the web
 * against a local API before the Kakao and Google secrets exist (auth.md). Only when
 * DEV_LOGIN=true, which production refuses to boot with; otherwise 404 like any
 * unknown route. HTTP only: the user and the session come from the services.
 */
@Controller('auth')
export class DevLoginController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Post('dev-login')
  @HttpCode(204)
  login(
    @Body(new ZodValidationPipe(z.object({ key: z.string().regex(/^[a-z0-9-]{1,24}$/) }).strict()))
    body: { key: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    if (!this.config.devLogin || this.config.nodeEnv === 'production') {
      throw new AppError('NOT_FOUND', { reason: 'dev login is off' });
    }
    // Same CSRF rule as every cookie write (tech-spec 9.4): no cross-site form can log you in.
    if (req.headers['x-requested-with'] === undefined) {
      throw new AppError('FORBIDDEN', { reason: 'missing X-Requested-With' });
    }
    // The previous session ends here, so one browser never holds two live sids.
    const old = credentialFrom(req);
    if (old?.viaCookie === true) this.auth.revoke(old.token);
    const token = this.auth.issue(this.users.ensureDevUser(body.key), 'web');
    // One sid cookie on Path=/ only (auth.md); not Secure because dev runs on http://localhost.
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }
}
