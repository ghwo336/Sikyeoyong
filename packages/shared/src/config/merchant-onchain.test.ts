import { describe, expect, it } from 'vitest';
import { parseMerchantOnchain, withMerchantEntry } from './merchant-onchain.js';

const h = (c: string) => `0x${c.repeat(64)}`;
const entry = (key: string, id: string, addrChar: string) => ({
  merchantKey: key,
  onchainId: id,
  payout: `0x${addrChar.repeat(40)}`,
  metadataUri: `http://localhost:3000/api/merchants/${key}/meta.json`,
  txs: { fund: h('a') as string | null, register: h('b'), activate: h('c') },
  blocks: { register: 10, activate: 11 },
});
const base = {
  chainId: 31337,
  profile: 'demo' as const,
  proxy: `0x${'1'.repeat(40)}`,
  merchants: [] as unknown[],
};

describe('merchant onchain record', () => {
  it('parses a valid record', () => {
    const r = parseMerchantOnchain({ ...base, merchants: [entry('a-01', '1', '2')] });
    expect(r.merchants[0]?.onchainId).toBe('1');
  });
  it('rejects a numeric id, a bad hash and an unknown profile', () => {
    const e = entry('a', '1', '2');
    expect(() => parseMerchantOnchain({ ...base, merchants: [{ ...e, onchainId: 1 }] })).toThrow();
    expect(() =>
      parseMerchantOnchain({
        ...base,
        merchants: [{ ...e, txs: { fund: null, register: 'x', activate: h('c') } }],
      }),
    ).toThrow();
    expect(() => parseMerchantOnchain({ ...base, profile: 'nope' })).toThrow();
  });
  it('rejects duplicate keys, ids and payouts', () => {
    const dup = (a: ReturnType<typeof entry>, b: ReturnType<typeof entry>) =>
      parseMerchantOnchain({ ...base, merchants: [a, b] });
    expect(() => dup(entry('a', '1', '2'), entry('a', '2', '3'))).toThrow();
    expect(() => dup(entry('a', '1', '2'), entry('b', '1', '3'))).toThrow();
    expect(() => dup(entry('a', '1', '2'), entry('b', '2', '2'))).toThrow();
  });
  it('accepts a null fund hash', () => {
    const e = entry('a', '1', '2');
    expect(() =>
      parseMerchantOnchain({ ...base, merchants: [{ ...e, txs: { ...e.txs, fund: null } }] }),
    ).not.toThrow();
  });
  it('adds entries sorted by numeric id, replacing by key', () => {
    let r = parseMerchantOnchain(base);
    r = withMerchantEntry(r, entry('b', '10', '3'));
    r = withMerchantEntry(r, entry('a', '9', '2'));
    expect(r.merchants.map((m) => m.onchainId)).toEqual(['9', '10']);
    r = withMerchantEntry(r, { ...entry('a', '9', '2'), blocks: { register: 99, activate: 100 } });
    expect(r.merchants).toHaveLength(2);
    expect(r.merchants[0]?.blocks.register).toBe(99);
  });
});
