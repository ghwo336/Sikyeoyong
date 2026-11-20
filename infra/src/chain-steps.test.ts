import { existsSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SpendGuard } from './connect.ts';
import { assertChainId, assertNoRecord, extractPolicies, preflight } from './chain-steps.ts';
import { recordExists, recordPath, writeRecord } from './record.ts';

const TEST_CHAIN = 999_999_991;

const record = (over: Record<string, unknown> = {}) => ({
  chainId: TEST_CHAIN,
  profile: 'demo' as const,
  deployedAt: '2026-11-21',
  operator: '0x1000000000000000000000000000000000000001',
  implementation: '0x1000000000000000000000000000000000000002',
  proxy: '0x1000000000000000000000000000000000000003',
  deployBlock: 5,
  txs: {
    implementation: `0x${'1'.repeat(64)}`,
    proxy: `0x${'2'.repeat(64)}`,
    policies: `0x${'3'.repeat(64)}`,
  },
  blocks: { implementation: 3, proxy: 5, policies: 7 },
  policyHash: `0x${'4'.repeat(64)}`,
  policies: [],
  ...over,
});

afterEach(() => {
  rmSync(recordPath(TEST_CHAIN, 'demo'), { force: true });
});

describe('extractPolicies', () => {
  const one = { templateId: 't1', policy: '0xaa', selector: '0x11223344', extra: 'x' };
  it('accepts a bare array and keeps only the three fields', () => {
    expect(extractPolicies([one])).toEqual([
      { templateId: 't1', policy: '0xaa', selector: '0x11223344' },
    ]);
  });
  it('accepts {policies: [...]}', () => {
    expect(extractPolicies({ policies: [one] })).toHaveLength(1);
  });
  it('empty array is an empty set', () => {
    expect(extractPolicies([])).toEqual([]);
  });
  it('rejects other shapes', () => {
    expect(() => extractPolicies({})).toThrow(/unexpected/);
    expect(() => extractPolicies({ policies: 'no' })).toThrow(/unexpected/);
  });
});

describe('record guard', () => {
  it('writeRecord validates, writes, and recordExists sees it', () => {
    expect(recordExists(TEST_CHAIN, 'demo')).toBe(false);
    const path = writeRecord(record());
    expect(path).toBe(recordPath(TEST_CHAIN, 'demo'));
    expect(existsSync(path)).toBe(true);
    expect(recordExists(TEST_CHAIN, 'demo')).toBe(true);
    expect(recordExists(TEST_CHAIN, 'default')).toBe(false);
  });
  it('writeRecord refuses an invalid record and writes nothing', () => {
    expect(() => writeRecord(record({ proxy: 'nope' }))).toThrow();
    expect(recordExists(TEST_CHAIN, 'demo')).toBe(false);
  });
  it('assertNoRecord refuses an existing record unless force', () => {
    assertNoRecord(TEST_CHAIN, 'demo', false);
    writeRecord(record());
    expect(() => {
      assertNoRecord(TEST_CHAIN, 'demo', false);
    }).toThrow(/record exists.*--force/);
    expect(() => {
      assertNoRecord(TEST_CHAIN, 'demo', true);
    }).not.toThrow();
  });
});

describe('assertChainId', () => {
  it('passes on a match and throws on a mismatch', async () => {
    await expect(
      assertChainId({ getChainId: () => Promise.resolve(12345) }, 12345),
    ).resolves.toBeUndefined();
    await expect(assertChainId({ getChainId: () => Promise.resolve(1) }, 12345)).rejects.toThrow(
      /RPC chain id 1 differs from config 12345; nothing sent/,
    );
  });
});

describe('preflight budget', () => {
  const fake = (gas: bigint, price: bigint, balance: bigint) =>
    ({
      account: { address: '0x1000000000000000000000000000000000000001' },
      publicClient: {
        call: () => Promise.resolve({}),
        estimateGas: () => Promise.resolve(gas),
        getGasPrice: () => Promise.resolve(price),
        getBalance: () => Promise.resolve(balance),
      },
    }) as never;
  const tx = { to: undefined, data: '0x00' as const };
  const log = () => undefined;

  it('uses twice the estimate: passes at the exact budget, fails one over', async () => {
    // worst = 2 * 50 * 10 = 1000
    await expect(
      preflight(fake(50n, 10n, 5_000n), new SpendGuard(5_000n, 1_000n), tx, 'x', log),
    ).resolves.toBe(50n);
    await expect(
      preflight(fake(50n, 10n, 5_000n), new SpendGuard(5_000n, 999n), tx, 'x', log),
    ).rejects.toThrow(/gas budget/);
  });
  it('counts the balance drop so far', async () => {
    await expect(
      preflight(fake(50n, 10n, 4_999n), new SpendGuard(5_000n, 1_000n), tx, 'x', log),
    ).rejects.toThrow(/gas budget/);
  });
});
