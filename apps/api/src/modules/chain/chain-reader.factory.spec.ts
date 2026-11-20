import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { createPaymentProvider } from '../payment/payment.service.js';
import { createChainReader } from './chain-reader.factory.js';

const PROD = {
  NODE_ENV: 'production',
  REAUTH_MODE: 'pouch',
  POUCHI_API_URL: 'https://pouchi.example',
  POUCHI_TENANT_ID: 'tenant_test',
  POUCHI_APP_KEY: 'test-app-key',
  POUCHI_APP_ID: 'app-test',
  SESSION_SECRET: 'x'.repeat(32),
  ANTHROPIC_API_KEY: 'k',
  LLM_MODEL: 'm',
  OPERATOR_KEY: 'o',
  ORDERS_CONTRACT: '0xcontract',
  AGENT_KEY_ENCRYPTION_KEY: 'e',
};

describe('createChainReader', () => {
  it.each(['development', 'test'] as const)('%s reads an empty window', async (NODE_ENV) => {
    const r = createChainReader(loadConfig({ NODE_ENV }));
    await expect(r.periodicVolume('0x0000000000000000000000000000000000000001')).resolves.toEqual({
      usedAokrw: 0n,
      resetAtSec: null,
    });
  });

  it('production never makes up a chain figure before the real reader exists', async () => {
    const r = createChainReader(loadConfig(PROD));
    const err = await r.periodicVolume(null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INTERNAL');
  });
});

describe('createChainReader on the mock chain (PAYMENT_PATH=mock)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a payment fills the 30-day window the budget and wallet screens show', async () => {
    const config = loadConfig({ PAYMENT_PATH: 'mock', POLICY_PROFILE: 'demo' });
    let clock = 1_700_000_000_500;
    const at = (ms: number) => {
      clock = ms;
      vi.setSystemTime(ms);
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    at(clock);
    const payment = createPaymentProvider(config);
    const reader = createChainReader(config, payment);
    const agent = await payment.createAgent({ userId: 'u1', name: '용이' });
    expect(await reader.periodicVolume(agent.address)).toEqual({ usedAokrw: 0n, resetAtSec: null });
    const amount = okrwToAokrw(1_000n);
    await payment.setTransferLimit(agent, amount);
    await payment.fund(agent, amount * 2n);
    const pay = (ref: string) =>
      payment.pay({ agent, merchantOnchainId: 1n, amount, orderRef: `0x${ref.repeat(64)}` });

    expect(await pay('a')).toMatchObject({ ok: true });
    // The window edge is a unix multiple of the period (3,600 s), not first order + period:
    // 1700000000 s is 800 s into the hour that began at 1699999200, so it resets at 1700002800.
    const resetAtSec = 1_700_002_800;
    expect(await reader.periodicVolume(agent.address)).toEqual({ usedAokrw: amount, resetAtSec });

    // A second order adds to the same window; the reset stays the same.
    at(clock + 60_000);
    expect(await pay('b')).toMatchObject({ ok: true });
    expect(await reader.periodicVolume(agent.address)).toEqual({
      usedAokrw: amount * 2n,
      resetAtSec,
    });

    // One millisecond before the end it still counts; at the end it is empty again.
    at(resetAtSec * 1000 - 1);
    expect((await reader.periodicVolume(agent.address)).usedAokrw).toBe(amount * 2n);
    at(clock + 1);
    expect(await reader.periodicVolume(agent.address)).toEqual({ usedAokrw: 0n, resetAtSec: null });
  });

  it('a wallet with no address yet reads an empty window', async () => {
    const config = loadConfig({ PAYMENT_PATH: 'mock' });
    const reader = createChainReader(config, createPaymentProvider(config));
    expect(await reader.periodicVolume(null)).toEqual({ usedAokrw: 0n, resetAtSec: null });
  });
});
