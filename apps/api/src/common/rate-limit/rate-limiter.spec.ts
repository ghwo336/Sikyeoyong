import { describe, expect, it } from 'vitest';
import { RateLimiter, SWEEP_EVERY_MS } from './rate-limiter.js';

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

  it('sweeps out quiet keys on another key call once their window has passed', () => {
    const r = new RateLimiter();
    for (let i = 0; i < 100; i += 1) r.allow(`u${String(i)}`, RULE, 0);
    expect(r.size).toBe(100);
    r.allow('fresh', RULE, RULE.windowMs + 1);
    expect(r.size).toBe(1);
  });

  it('never sweeps a key still blocked in its own (longer) window when another rule sweeps', () => {
    const r = new RateLimiter();
    const LONG = { limit: 1, windowMs: 10 * 60_000 };
    r.allow('long', LONG, 0);
    r.allow('short', RULE, SWEEP_EVERY_MS + 1); // past RULE's window, inside LONG's
    expect(r.allow('long', LONG, SWEEP_EVERY_MS + 2)).toBe(false);
  });

  it('sweeps at most once a minute, not on every call', () => {
    const r = new RateLimiter();
    const SHORT = { limit: 3, windowMs: 1_000 };
    r.allow('x', RULE, 0); // sweep at 0
    r.allow('quiet', SHORT, 10);
    r.allow('y', RULE, 5_000); // quiet is past its 1s window, but no sweep within a minute
    expect(r.size).toBe(3);
  });

  it('drops a key whose newest hit sits exactly on the window edge', () => {
    const r = new RateLimiter();
    r.allow('edge', RULE, 0);
    r.allow('z', RULE, SWEEP_EVERY_MS); // sweep at 60,000: newest 0 <= 60,000 - 60,000
    expect(r.size).toBe(1);
  });

  it('keeps keys apart', () => {
    const r = new RateLimiter();
    for (const t of [0, 1, 2]) r.allow('chat:u1', RULE, t);
    expect(r.allow('chat:u2', RULE, 3)).toBe(true);
    expect(r.allow('chat:u1', RULE, 3)).toBe(false);
  });
});
