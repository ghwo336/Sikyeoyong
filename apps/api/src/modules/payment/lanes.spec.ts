import { describe, expect, it } from 'vitest';
import { Lanes } from './lanes.js';

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('Lanes', () => {
  it('runs jobs of one key one after another, in order', async () => {
    const lanes = new Lanes();
    const log: string[] = [];
    const gate = deferred();
    const first = lanes.run('0xAA', async () => {
      log.push('a:start');
      await gate.promise;
      log.push('a:end');
    });
    const second = lanes.run('0xaa', () => {
      log.push('b:start');
      return Promise.resolve();
    });
    await Promise.resolve();
    expect(log).toEqual(['a:start']);
    gate.resolve();
    await Promise.all([first, second]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start']);
  });

  it('lets other keys run at the same time', async () => {
    const lanes = new Lanes();
    const gate = deferred();
    const slow = lanes.run('k1', () => gate.promise);
    const fast = await lanes.run('k2', () => Promise.resolve('done'));
    expect(fast).toBe('done');
    gate.resolve();
    await slow;
  });

  it('a failed job reaches its caller and does not block the next', async () => {
    const lanes = new Lanes();
    const bad = lanes.run('k', () => Promise.reject(new Error('boom')));
    const good = lanes.run('k', () => Promise.resolve(1));
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe(1);
  });
});
