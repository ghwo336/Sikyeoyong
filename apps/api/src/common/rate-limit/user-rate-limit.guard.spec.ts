/* eslint-disable @typescript-eslint/unbound-method -- handlers are only read as metadata keys */
import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';
import {
  USER_RATES,
  userRateNameOf,
  UserRateLimitGuard,
  UserRateLimited,
} from './user-rate-limit.guard.js';

class Probe {
  @UserRateLimited('order')
  limited(): void {}
  free(): void {}
}

function ctx(handler: () => void, userId: string | undefined): ExecutionContext {
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({ sessionUser: userId === undefined ? undefined : { userId } }),
    }),
  } as unknown as ExecutionContext;
}

const guard = () => new UserRateLimitGuard(new Reflector(), new RateLimiter());
const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : 'other';
  }
  return undefined;
};

describe('UserRateLimitGuard (tech-spec 9.5)', () => {
  it('lets a user through up to the limit, then answers RATE_LIMITED', () => {
    const g = guard();
    const h = Probe.prototype.limited;
    for (let i = 0; i < USER_RATES.order.limit; i += 1) {
      expect(g.canActivate(ctx(h, 'u1'))).toBe(true);
    }
    expect(codeOf(() => g.canActivate(ctx(h, 'u1')))).toBe('RATE_LIMITED');
  });

  it('counts each user alone', () => {
    const g = guard();
    const h = Probe.prototype.limited;
    for (let i = 0; i < USER_RATES.order.limit; i += 1) g.canActivate(ctx(h, 'u1'));
    expect(g.canActivate(ctx(h, 'u2'))).toBe(true);
  });

  it('leaves routes without a mark alone, and refuses a missing session', () => {
    const g = guard();
    for (let i = 0; i < 50; i += 1) {
      expect(g.canActivate(ctx(Probe.prototype.free, 'u1'))).toBe(true);
    }
    expect(codeOf(() => g.canActivate(ctx(Probe.prototype.limited, undefined)))).toBe(
      'UNAUTHENTICATED',
    );
  });
});

describe('userRateNameOf', () => {
  it('reads the mark of a handler', () => {
    expect(userRateNameOf(Probe.prototype.limited)).toBe('order');
    expect(userRateNameOf(Probe.prototype.free)).toBeUndefined();
  });

  it('keeps the spec 9.5 numbers for orders and approvals', () => {
    expect(USER_RATES.order).toEqual({ limit: 5, windowMs: 600_000 });
    expect(USER_RATES.approval).toEqual({ limit: 30, windowMs: 3_600_000 });
  });
});
