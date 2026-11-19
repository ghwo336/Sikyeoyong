import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import { NETWORKS, explorerTxUrl, isNetworkKey, resolveChainConfig } from './chain.js';

describe('NETWORKS', () => {
  it('holds the testnet facts from maroo-facts.md', () => {
    const t = NETWORKS['maroo-testnet'];
    expect(t.chainId).toBe(450815);
    expect(t.rpcUrl).toBe('https://rpc-testnet.maroo.io');
    expect(t.wsUrl).toBe('wss://ws-testnet.maroo.io');
    expect(t.explorerUrl).toBe('https://explorer-testnet.maroo.io');
    expect(t.okrwDenom).toBe('atokrw');
    expect(t.okrwDecimals).toBe(18);
    expect(t.precompiles).toEqual({
      pcl: '0x1000000000000000000000000000000000000005',
      agent: '0x100000000000000000000000000000000000000A',
      identityRegistry: '0x8004000000000000000000000000000000000001',
      schemaRegistry: '0x1000000000000000000000000000000000000006',
    });
  });

  it('uses 20-byte hex addresses for every precompile', () => {
    for (const address of Object.values(NETWORKS['maroo-testnet'].precompiles)) {
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});

describe('resolveChainConfig', () => {
  it('returns the defaults without overrides', () => {
    expect(resolveChainConfig('maroo-testnet')).toEqual(NETWORKS['maroo-testnet']);
  });

  it('applies env overrides (chain id is going to change)', () => {
    const c = resolveChainConfig('maroo-testnet', {
      chainId: 777,
      rpcUrl: 'http://localhost:8545',
      okrwDenom: 'aokrw',
    });
    expect(c.chainId).toBe(777);
    expect(c.rpcUrl).toBe('http://localhost:8545');
    expect(c.okrwDenom).toBe('aokrw');
    expect(c.precompiles).toEqual(NETWORKS['maroo-testnet'].precompiles);
  });

  it('ignores undefined overrides', () => {
    expect(resolveChainConfig('maroo-testnet', { chainId: undefined }).chainId).toBe(450815);
  });

  it('does not mutate the shared defaults', () => {
    resolveChainConfig('maroo-testnet', { chainId: 1 });
    expect(NETWORKS['maroo-testnet'].chainId).toBe(450815);
  });

  it.each([0, -1, 1.5, Number.NaN, 2 ** 60])('rejects chain id %s', (chainId) => {
    expect(() => resolveChainConfig('maroo-testnet', { chainId })).toThrow(AppError);
  });

  it('rejects unknown networks and non-http rpc urls', () => {
    expect(() => resolveChainConfig('mainnet')).toThrow(AppError);
    expect(() => resolveChainConfig('toString')).toThrow(AppError);
    expect(() => resolveChainConfig('maroo-testnet', { rpcUrl: 'ftp://x' })).toThrow(AppError);
  });

  it('isNetworkKey only accepts own keys', () => {
    expect(isNetworkKey('maroo-testnet')).toBe(true);
    expect(isNetworkKey('__proto__')).toBe(false);
    expect(isNetworkKey('constructor')).toBe(false);
  });
});

describe('explorerTxUrl', () => {
  const hash = `0x${'ab'.repeat(32)}`;

  it('builds the tx link', () => {
    expect(explorerTxUrl(NETWORKS['maroo-testnet'], hash)).toBe(
      `https://explorer-testnet.maroo.io/tx/${hash}`,
    );
  });

  it.each(['', '0x1', `0x${'zz'.repeat(32)}`, 'ab'.repeat(32), `0x${'ab'.repeat(32)}/../x`])(
    'rejects %j',
    (bad) => {
      expect(() => explorerTxUrl(NETWORKS['maroo-testnet'], bad)).toThrow(AppError);
    },
  );
});
