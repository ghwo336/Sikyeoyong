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

interface Credential {
  readonly token: string;
  /** Bearer requests come from the native app and carry no ambient cookie. */
  readonly viaCookie: boolean;
}

/**
 * sid cookie (web) or Bearer token (native), tech-spec 2.3. The auth scheme is
 * case-insensitive (RFC 7235). A request with more than one sid cookie gets no
 * credential at all, so a cookie planted from elsewhere cannot win the race.
 */
export function credentialFrom(req: Request): Credential | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = /^bearer (.*)$/i.exec(auth);
    if (m) return { token: m[1] ?? '', viaCookie: false };
  }
  const cookie = req.headers.cookie;
  if (typeof cookie !== 'string') return null;
  const values: string[] = [];
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) values.push(rest.join('='));
  }
  return values.length === 1 && values[0] !== undefined
    ? { token: values[0], viaCookie: true }
    : null;
}

/**
 * Requires a live session and, for writes from the web, the X-Requested-With
 * header (CSRF, tech-spec 9.4). Bearer requests skip the header check.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const cred = credentialFrom(req);
    const user = cred === null ? null : this.auth.resolve(cred.token);
    if (cred === null || user === null) throw new AppError('UNAUTHENTICATED');
    if (
      cred.viaCookie &&
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
