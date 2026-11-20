import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import type { Request } from 'express';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/**
 * Runs before any pipe: with DEV_LOGIN off (or in production) the route answers 404
 * like an unknown one, whatever the body, so nothing tells it exists. With it on, the
 * cookie-write CSRF rule applies (X-Requested-With, tech-spec 9.4).
 */
@Injectable()
export class DevLoginGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.devLogin || this.config.nodeEnv === 'production') {
      throw new AppError('NOT_FOUND', { reason: 'dev login is off' });
    }
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers['x-requested-with'] === undefined) {
      throw new AppError('FORBIDDEN', { reason: 'missing X-Requested-With' });
    }
    return true;
  }
}
