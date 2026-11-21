import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_LOCK_HOLD_MS,
  AGENT_LOCK_WAIT_MS,
  AgentLock,
  AgentLockTimeout,
} from './agent-lock.service.js';

// A hung RPC must not block an owner action (freeze) forever: waiting and holding are bounded.

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('AgentLock bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs turns of one agent in order and different agents in parallel', async () => {
    const lock = new AgentLock();
    const gate = deferred();
    const events: string[] = [];
    const first = lock.run('a', async () => {
      await gate.promise;
      events.push('first');
    });
    const second = lock.run('a', () => {
      events.push('second');
      return Promise.resolve();
    });
    await lock.run('b', () => {
      events.push('other');
      return Promise.resolve();
    });
    expect(events).toEqual(['other']);
    gate.resolve();
    await Promise.all([first, second]);
    expect(events).toEqual(['other', 'first', 'second']);
  });

  it('a waiter gives up after the wait bound with a clear error and its fn never runs', async () => {
    const lock = new AgentLock();
    const hung = deferred();
    void lock.run('a', () => hung.promise, { waitMs: 1000, holdMs: 10 * AGENT_LOCK_HOLD_MS });
    const ran = vi.fn(() => Promise.resolve());
    const caught = lock.run('a', ran, { waitMs: 1000, holdMs: 1000 }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await caught;
    expect(err).toBeInstanceOf(AgentLockTimeout);
    expect((err as AgentLockTimeout).phase).toBe('wait');
    expect((err as AgentLockTimeout).code).toBe('RATE_LIMITED');
    expect(ran).not.toHaveBeenCalled();
  });

  it('a timed-out waiter does not let the ones behind it jump the holder', async () => {
    const lock = new AgentLock();
    const hung = deferred();
    void lock.run('a', () => hung.promise, { waitMs: 1000, holdMs: 10 * AGENT_LOCK_HOLD_MS });
    const quitCaught = lock
      .run('a', () => Promise.resolve(), { waitMs: 500, holdMs: 1000 })
      .catch((e: unknown) => e);
    const ran = vi.fn(() => Promise.resolve('late'));
    const behind = lock.run('a', ran, { waitMs: 100_000, holdMs: 1000 });
    await vi.advanceTimersByTimeAsync(500);
    expect(await quitCaught).toBeInstanceOf(AgentLockTimeout);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ran).not.toHaveBeenCalled();
    hung.resolve();
    await expect(behind).resolves.toBe('late');
  });

  it('a hung holder is released after the hold bound: the caller errors, the next turn runs, fn is not cancelled', async () => {
    const lock = new AgentLock();
    const hung = deferred();
    let finished = false;
    const holderCaught = lock
      .run(
        'a',
        async () => {
          await hung.promise;
          finished = true;
        },
        { waitMs: 1000, holdMs: 1000 },
      )
      .catch((e: unknown) => e);
    const next = lock.run('a', () => Promise.resolve('frozen'));
    await vi.advanceTimersByTimeAsync(1000);
    const err = await holderCaught;
    expect(err).toBeInstanceOf(AgentLockTimeout);
    expect((err as AgentLockTimeout).phase).toBe('hold');
    await expect(next).resolves.toBe('frozen');
    expect(finished).toBe(false);
    hung.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).toBe(true);
  });

  it('defaults are 120 s each and a fast turn leaves no timer behind', async () => {
    expect(AGENT_LOCK_WAIT_MS).toBe(120_000);
    expect(AGENT_LOCK_HOLD_MS).toBe(120_000);
    const lock = new AgentLock();
    await expect(lock.run('a', () => Promise.resolve(1))).resolves.toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a throwing fn still frees the turn', async () => {
    const lock = new AgentLock();
    await expect(lock.run('a', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(lock.run('a', () => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
