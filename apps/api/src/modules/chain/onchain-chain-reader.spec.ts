import { AppError, DEPLOYMENTS, okrwToAokrw, type PaymentProvider } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { PLACE_ORDER_SELECTOR } from '../../common/onchain/orders-abi.js';
import { loadConfig } from '../../config/env.js';
import { createChainReader } from './chain-reader.factory.js';
import { createOnchainChainReader, type PclPort } from './onchain-chain-reader.js';

// No network in tests: the SDK client is replaced by a fake whose pcl answers from this mock.
const contractPeriodicVolume = vi.hoisted(() => vi.fn());
vi.mock('../../common/onchain/clients.js', () => ({
  createMarooPublicClient: () => ({ pcl: { contractPeriodicVolume } }),
}));

const WALLET = '0x00000000000000000000000000000000000000aa';
const config = loadConfig({ PAYMENT_PATH: 'B', POLICY_PROFILE: 'demo' });
const demo = DEPLOYMENTS.find((d) => d.profile === 'demo');
const PERIOD = BigInt(config.policy.periodicPeriodSec);
const status = (amount: bigint, resetAt: bigint, period = PERIOD) => ({
  amount,
  maxAmount: config.policy.periodicCapAokrw,
  resetPeriodSeconds: period,
  resetAt,
});
const port = (
  statuses: ReturnType<typeof status>[],
): PclPort & { spy: ReturnType<typeof vi.fn> } => {
  const spy = vi.fn(() => Promise.resolve(statuses));
  return { contractPeriodicVolume: spy, spy };
};

describe('the real chain reader for path B (contractPeriodicVolume)', () => {
  it('asks the PCL precompile about the proxy, the agent wallet, the placeOrder selector and the denom', async () => {
    const p = port([status(okrwToAokrw(9_000n), 1_795_190_400n)]);
    const reader = createOnchainChainReader(config, p);
    expect(await reader.periodicVolume(WALLET)).toEqual({
      usedAokrw: okrwToAokrw(9_000n),
      resetAtSec: 1_795_190_400,
    });
    expect(p.spy).toHaveBeenCalledWith({
      contract: demo?.proxy,
      user: WALLET,
      selector: PLACE_ORDER_SELECTOR,
      asset: 'atokrw',
      resetPeriodSeconds: PERIOD,
      resolveAgentOwners: false,
    });
  });

  it('nothing counted yet has no window (resetAt 0 is null)', async () => {
    const reader = createOnchainChainReader(config, port([status(0n, 0n)]));
    expect(await reader.periodicVolume(WALLET)).toEqual({ usedAokrw: 0n, resetAtSec: null });
    expect(await createOnchainChainReader(config, port([])).periodicVolume(WALLET)).toEqual({
      usedAokrw: 0n,
      resetAtSec: null,
    });
  });

  it('with several statuses, the one with our period wins', async () => {
    const reader = createOnchainChainReader(
      config,
      port([status(1n, 5n, 60n), status(okrwToAokrw(1n), 9n)]),
    );
    expect(await reader.periodicVolume(WALLET)).toEqual({
      usedAokrw: okrwToAokrw(1n),
      resetAtSec: 9,
    });
  });

  it('a wallet with no address yet reads an empty window without asking the chain', async () => {
    const p = port([status(1n, 1n)]);
    expect(await createOnchainChainReader(config, p).periodicVolume(null)).toEqual({
      usedAokrw: 0n,
      resetAtSec: null,
    });
    expect(p.spy).not.toHaveBeenCalled();
  });

  it('a chain failure reaches the caller (a screen never shows a made-up figure)', async () => {
    const reader = createOnchainChainReader(config, {
      contractPeriodicVolume: () => Promise.reject(new Error('rpc down')),
    });
    await expect(reader.periodicVolume(WALLET)).rejects.toThrow('rpc down');
  });

  it('the placeOrder selector is the one the deployed policies hang on', () => {
    expect(demo?.policies.map((p) => p.selector)).toContain(PLACE_ORDER_SELECTOR);
  });
});

describe('createChainReader picks the real reader for a path B provider', () => {
  const pathB = { path: 'B' } as PaymentProvider;

  it('uses the chain (not the development window) when the payment path is B', async () => {
    contractPeriodicVolume.mockResolvedValueOnce([status(okrwToAokrw(3n), 77n)]);
    const reader = createChainReader(config, pathB);
    expect(await reader.periodicVolume(WALLET)).toEqual({
      usedAokrw: okrwToAokrw(3n),
      resetAtSec: 77,
    });
  });

  it('production without a deployed proxy stops instead of faking a window', () => {
    const prod = {
      ...config,
      nodeEnv: 'production' as const,
      orders: { contractOverride: '0xnothex', deployBlockOverride: undefined },
    };
    expect(() => createChainReader(prod, pathB)).toThrow(AppError);
  });

  it('outside production without a proxy it falls back to the development window', async () => {
    const dev = {
      ...config,
      orders: { contractOverride: '0xnothex', deployBlockOverride: undefined },
    };
    expect(await createChainReader(dev, pathB).periodicVolume(WALLET)).toEqual({
      usedAokrw: 0n,
      resetAtSec: null,
    });
  });
});
