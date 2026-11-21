import type { PaymentProvider } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { verifyChainId } from './chain-id-guard.js';

const B = { path: 'B' } as PaymentProvider;
const PROXY = `0x${'11'.repeat(20)}`;
// A deployed proxy through the override, so the real-chain path is taken (no network).
const env = (extra: Record<string, string> = {}) => ({
  PAYMENT_PATH: 'B',
  CHAIN_ID: '777',
  ORDERS_CONTRACT: PROXY,
  ...extra,
});

describe('verifyChainId (chain-and-pcl.md: eth_chainId must match shared config at boot)', () => {
  it('passes when the RPC answers the configured chain id', async () => {
    const getChainId = vi.fn(() => Promise.resolve(777));
    await expect(verifyChainId(loadConfig(env()), B, { getChainId })).resolves.toBeUndefined();
    expect(getChainId).toHaveBeenCalledTimes(1);
  });

  it('refuses to start when the RPC answers another chain id', async () => {
    await expect(
      verifyChainId(loadConfig(env()), B, { getChainId: () => Promise.resolve(450816) }),
    ).rejects.toMatchObject({
      code: 'INTERNAL',
      detail: { reason: expect.stringContaining('777') as unknown },
    });
  });

  it('does nothing on the mock path and asks no RPC', async () => {
    const getChainId = vi.fn(() => Promise.resolve(1));
    await verifyChainId(loadConfig({ PAYMENT_PATH: 'mock' }), { path: 'mock' } as PaymentProvider, {
      getChainId,
    });
    expect(getChainId).not.toHaveBeenCalled();
  });

  it('in development a path B setup with no deployed proxy is skipped (it pays nothing there)', async () => {
    const getChainId = vi.fn(() => Promise.resolve(1));
    await verifyChainId(loadConfig({ PAYMENT_PATH: 'B', CHAIN_ID: '12345' }), B, { getChainId });
    expect(getChainId).not.toHaveBeenCalled();
  });

  it('an unreadable RPC warns in development and refuses in production', async () => {
    const down = { getChainId: () => Promise.reject(new Error('ECONNREFUSED')) };
    const warn = vi.fn();
    await verifyChainId(loadConfig(env()), B, down, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    // A production-mode config over the same chain settings (loadConfig would ask for every secret).
    const prod = { ...loadConfig(env()), nodeEnv: 'production' as const };
    await expect(verifyChainId(prod, B, down)).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
