import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE, sessionCookieFrom } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService, SESSION_TTL_MS } from '../auth/auth.service.js';
import { DevLoginGuard } from './dev-login.guard.js';
import { UsersService } from './users.service.js';

/**
 * POST /api/auth/dev-login: a session cookie without OAuth, for running the web against a
 * local API before the Kakao and Google secrets exist (auth.md). DevLoginGuard opens it only
 * with DEV_LOGIN=true outside production. HTTP only: user and session come from services.
 */
@Controller('auth')
@UseGuards(DevLoginGuard)
export class DevLoginController {
  constructor(
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
    const token = this.auth.rotate(
      sessionCookieFrom(req),
      this.users.ensureDevUser(body.key),
      'web',
    );
    // One sid cookie on Path=/ only (auth.md); not Secure because dev runs on http://localhost.
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }
}
