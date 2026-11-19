import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();
const T0 = Date.UTC(2026, 10, 19, 3, 0);

/** Run a mock call to the end with fake time. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(300);
  return p;
}

const setup = () => settle(mockApi.getAgentSetup());
const statuses = async () => (await setup()).steps.map((s) => s.status);

describe('mock sign-up', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hatches step by step: waiting, then doing to done, then ACTIVE', async () => {
    const before = await settle(mockApi.getAgentSetup());
    expect(before.status).toBe('PENDING');
    expect(before.steps.map((s) => s.status)).toEqual(['waiting', 'waiting', 'waiting']);

    vi.setSystemTime(T0);
    await settle(mockApi.createAgent({ dragonName: '봄봄', dragonSpecies: 'star' }));
    // createAgent started the clock at T0; settle moved it 300ms.
    expect(await statuses()).toEqual(['doing', 'waiting', 'waiting']);
    // Midway the dragon is still PENDING, so the hatch screen keeps asking.
    vi.setSystemTime(T0 + 1_500);
    const first = await setup();
    expect(first.status).toBe('PENDING');
    expect(first.steps.map((s) => s.status)).toEqual(['done', 'doing', 'waiting']);
    vi.setSystemTime(T0 + 3_000);
    const second = await setup();
    expect(second.status).toBe('PENDING');
    expect(second.steps.map((s) => s.status)).toEqual(['done', 'done', 'doing']);
    vi.setSystemTime(T0 + 4_500);
    const after = await settle(mockApi.getAgentSetup());
    expect(after.status).toBe('ACTIVE');
    expect(after.steps.map((s) => s.status)).toEqual(['done', 'done', 'done']);

    const me = await settle(mockApi.getMe());
    expect(me).toMatchObject({ dragonName: '봄봄', dragonSpecies: 'star' });
  });

  it('a new budget changes the amount and the nag stage', async () => {
    // 210,000 spent: 70% of 300,000 (warn70), 42% of 500,000 (none), 105% of 200,000 (over100).
    await settle(mockApi.setMonthlyBudget(won(500_000n)));
    expect(await settle(mockApi.getBudget())).toMatchObject({
      personalBudget: won(500_000n),
      nagLevel: 'none',
    });
    await settle(mockApi.setMonthlyBudget(won(200_000n)));
    expect(await settle(mockApi.getBudget())).toMatchObject({
      personalBudget: won(200_000n),
      nagLevel: 'over100',
    });
  });
});
