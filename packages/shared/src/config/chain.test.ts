import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import { NETWORKS, explorerTxUrl, isNetworkKey, logRanges, resolveChainConfig } from './chain.js';

describe('NETWORKS', () => {
  it('holds the testnet facts from maroo-facts.md', () => {
    const t = NETWORKS['maroo-testnet'];
    expect(t.chainId).toBe(450815);
    expect(t.rpcUrl).toBe('https://rpc-testnet.maroo.io');
    expect(t.wsUrl).toBe('wss://ws-testnet.maroo.io');
    expect(t.explorerUrl).toBe('https://explorer-testnet.maroo.io');
    expect(t.okrwDenom).toBe('atokrw');
    expect(t.okrwDecimals).toBe(18);
    expect(t.maxLogBlockSpan).toBe(10_000);
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

  it.each(['', ' ', 'A', 'ok', 'Atokrw', 'a tokrw', 'atokrw\n'])(
    'rejects okrw denom %j',
    (okrwDenom) => {
      expect(() => resolveChainConfig('maroo-testnet', { okrwDenom })).toThrow(AppError);
    },
  );

  it('accepts the mainnet denom', () => {
    expect(resolveChainConfig('maroo-testnet', { okrwDenom: 'aokrw' }).okrwDenom).toBe('aokrw');
  });

  it.each(['', 'http://', 'https://', 'localhost:8545', 'ws://rpc', 'ftp://x'])(
    'rejects rpc url %j',
    (rpcUrl) => {
      expect(() => resolveChainConfig('maroo-testnet', { rpcUrl })).toThrow(AppError);
    },
  );

  it('freezes the defaults and resolved configs deeply', () => {
    const t = NETWORKS['maroo-testnet'];
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.precompiles)).toBe(true);
    expect(Object.isFrozen(resolveChainConfig('maroo-testnet'))).toBe(true);
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

describe('logRanges', () => {
  it('covers [from, to] exactly once, each range within the span, oldest first', () => {
    const r = logRanges(5n, 27n, 10n);
    expect(r).toEqual([
      { from: 5n, to: 14n },
      { from: 15n, to: 24n },
      { from: 25n, to: 27n },
    ]);
  });

  it('newest first walks down from the top and ends at from', () => {
    expect(logRanges(5n, 27n, 10n, true)).toEqual([
      { from: 18n, to: 27n },
      { from: 8n, to: 17n },
      { from: 5n, to: 7n },
    ]);
  });

  it('is one range when it fits, none when from is past to, and rejects a bad span', () => {
    expect(logRanges(3n, 3n, 10n)).toEqual([{ from: 3n, to: 3n }]);
    expect(logRanges(9n, 3n, 10n)).toEqual([]);
    expect(logRanges(9n, 3n, 10n, true)).toEqual([]);
    expect(() => logRanges(1n, 2n, 0n)).toThrow();
  });
});
