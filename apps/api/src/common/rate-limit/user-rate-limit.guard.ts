import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@sikyeoyong/shared';
import type { Request } from 'express';
import type { SessionUser } from '../../modules/auth/auth.service.js';
import { RateLimiter, type RateRule } from './rate-limiter.js';

/** Per-user limits of the write routes (tech-spec 9.5). Names are the bucket keys. */
export const USER_RATES = {
  /** POST /orders: new quotes. */
  order: { limit: 5, windowMs: 10 * 60_000 },
  /** POST /orders/:id/confirm and /requote: retries of one order are normal. */
  orderStep: { limit: 10, windowMs: 10 * 60_000 },
  /** POST /orders/:id/rating. */
  rating: { limit: 30, windowMs: 60 * 60_000 },
  /** POST /approvals/:id/approve and /reject share one bucket. */
  approval: { limit: 30, windowMs: 60 * 60_000 },
  /** POST /identity/verify. */
  verify: { limit: 10, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateRule>;

export type UserRateName = keyof typeof USER_RATES;

const META = 'user-rate-limit';

/** Marks a route as limited per session user. Use after SessionGuard in @UseGuards. */
export const UserRateLimited = (name: UserRateName) => SetMetadata(META, name);

/** The mark of a route handler, if any (tests read it to pin which routes are limited). */
export const userRateNameOf = (handler: () => unknown): UserRateName | undefined =>
  Reflect.getMetadata(META, handler) as UserRateName | undefined;

/** Answers RATE_LIMITED (429) once the session user passes the route's rule. */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const name = this.reflector.get<UserRateName | undefined>(META, context.getHandler());
    if (name === undefined) return true;
    const user = context
      .switchToHttp()
      .getRequest<Request & { sessionUser?: SessionUser }>().sessionUser;
    if (user === undefined) throw new AppError('UNAUTHENTICATED');
    if (!this.limiter.allow(`${name}:${user.userId}`, USER_RATES[name])) {
      throw new AppError('RATE_LIMITED', { reason: `${name} rate` });
    }
    return true;
  }
}
