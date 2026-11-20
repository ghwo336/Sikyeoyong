import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
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
  it('a payment fills the 30-day window the budget and wallet screens show', async () => {
    const config = loadConfig({ PAYMENT_PATH: 'mock', POLICY_PROFILE: 'demo' });
    const payment = createPaymentProvider(config);
    const reader = createChainReader(config, payment);
    const agent = await payment.createAgent({ userId: 'u1', name: '용이' });
    expect(await reader.periodicVolume(agent.address)).toEqual({ usedAokrw: 0n, resetAtSec: null });
    const amount = okrwToAokrw(4_500n);
    await payment.setTransferLimit(agent, amount);
    await payment.fund(agent, amount);
    const before = Date.now();
    const paid = await payment.pay({
      agent,
      merchantOnchainId: 1n,
      amount,
      orderRef: `0x${'a'.repeat(64)}`,
    });
    expect(paid).toMatchObject({ ok: true });
    const seen = await reader.periodicVolume(agent.address);
    expect(seen.usedAokrw).toBe(amount);
    // The demo profile's window is one hour (policy), from the first order.
    expect(seen.resetAtSec).toBeGreaterThanOrEqual(Math.floor(before / 1000) + 3600 - 1);
  });

  it('a wallet with no address yet reads an empty window', async () => {
    const config = loadConfig({ PAYMENT_PATH: 'mock' });
    const reader = createChainReader(config, createPaymentProvider(config));
    expect(await reader.periodicVolume(null)).toEqual({ usedAokrw: 0n, resetAtSec: null });
  });
});
