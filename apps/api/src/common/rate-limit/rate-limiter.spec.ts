import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

const RULE = { limit: 3, windowMs: 60_000 };

describe('RateLimiter', () => {
  it('allows up to the limit inside the window, then refuses', () => {
    const r = new RateLimiter();
    expect([0, 1, 2, 3].map((i) => r.allow('u1', RULE, 1_000 + i))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('lets a hit through again once the oldest leaves the window', () => {
    const r = new RateLimiter();
    for (const t of [0, 10, 20]) r.allow('u1', RULE, t);
    // The window is (now - 60s, now]: at 59,999 the hit at 0 still counts, at 60,000 it has left.
    expect(r.allow('u1', RULE, 59_999)).toBe(false);
    expect(r.allow('u1', RULE, 60_000)).toBe(true);
  });

  it('does not count refused hits', () => {
    const r = new RateLimiter();
    for (const t of [0, 1, 2]) r.allow('u1', RULE, t);
    for (let t = 3; t < 50; t += 1) r.allow('u1', RULE, t);
    expect(r.allow('u1', RULE, 60_001)).toBe(true);
  });

  it('keeps keys apart', () => {
    const r = new RateLimiter();
    for (const t of [0, 1, 2]) r.allow('chat:u1', RULE, t);
    expect(r.allow('chat:u2', RULE, 3)).toBe(true);
    expect(r.allow('chat:u1', RULE, 3)).toBe(false);
  });
});
