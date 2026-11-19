import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AppError } from '@sikyeoyong/shared';
import type { Request } from 'express';
import { AuthService, type SessionUser } from '../../modules/auth/auth.service.js';

export const SESSION_COOKIE = 'sid';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

type SessionRequest = Request & { sessionUser?: SessionUser };

/** sid cookie (web) or Bearer token (native), tech-spec 2.3. */
export function tokenFrom(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  const cookie = req.headers.cookie;
  if (typeof cookie !== 'string') return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return null;
}

/**
 * Requires a live session and, for writes from the web, the X-Requested-With
 * header (CSRF, tech-spec 9.4). Bearer requests come from the native app and
 * carry no ambient cookie, so they skip the header check.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const token = tokenFrom(req);
    const user = token === null ? null : this.auth.resolve(token);
    if (user === null) throw new AppError('UNAUTHENTICATED');
    const viaCookie = !(req.headers.authorization ?? '').startsWith('Bearer ');
    if (
      viaCookie &&
      !SAFE_METHODS.has(req.method) &&
      req.headers['x-requested-with'] === undefined
    ) {
      throw new AppError('FORBIDDEN', { reason: 'missing X-Requested-With' });
    }
    req.sessionUser = user;
    return true;
  }
}

/** The session user set by SessionGuard. Never read a user id from the body or the LLM. */
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<SessionRequest>().sessionUser;
  if (user === undefined) throw new AppError('UNAUTHENTICATED');
  return user;
});
