import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import type { Request } from 'express';

/**
 * Cookie-writing routes that run before a session exists (login): the same CSRF rule as
 * SessionGuard's writes (tech-spec 9.4), X-Requested-With must be present. A cross-site form
 * cannot set it, and a cross-site fetch with it needs a CORS preflight the API never allows.
 */
@Injectable()
export class CsrfHeaderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers['x-requested-with'] === undefined) {
      throw new AppError('FORBIDDEN', { reason: 'missing X-Requested-With' });
    }
    return true;
  }
}
