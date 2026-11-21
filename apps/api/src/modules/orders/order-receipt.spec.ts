import { NETWORKS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { buildReceiptJson, parseReceiptJson } from './order-receipt.js';

const tx = `0x${'ab'.repeat(32)}`;
const chain = NETWORKS['maroo-testnet'];

describe('buildReceiptJson', () => {
  it('real chain: server rules, then the three chain rules, link from the chain config', () => {
    const raw = buildReceiptJson({ onchainAgentId: '1042', txHash: tx, path: 'B', chain });
    const r = parseReceiptJson(raw);
    expect(r?.agentId).toBe('1042');
    expect(r?.rules.filter((x) => x.layer === 'server')).toHaveLength(3);
    expect(r?.rules.filter((x) => x.layer === 'chain').map((x) => x.id)).toEqual([
      'transfer-limit',
      'periodic-volume',
      'kyc',
    ]);
    expect(new Set(r?.rules.map((x) => x.status))).toEqual(new Set(['passed']));
    expect(r?.explorerUrl).toBe(`${chain.explorerUrl}/tx/${tx}`);
  });

  it('mock chain: no KYC claim, chain checks named as the mock chain', () => {
    const r = parseReceiptJson(
      buildReceiptJson({ onchainAgentId: '1', txHash: tx, path: 'mock', chain }),
    );
    const labels = r?.rules.filter((x) => x.layer === 'chain').map((x) => x.label) ?? [];
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.includes('흉내 체인'))).toBe(true);
    expect(JSON.stringify(r)).not.toContain('KYC');
    expect(r?.explorerUrl).toBeUndefined();
  });

  it('writes nothing when the dragon has no ID number or the hash is malformed', () => {
    expect(buildReceiptJson({ onchainAgentId: null, txHash: tx, path: 'B', chain })).toBeNull();
    expect(() =>
      buildReceiptJson({ onchainAgentId: '1', txHash: '0x12', path: 'B', chain }),
    ).toThrow();
  });

  it('an unreadable stored receipt is no receipt', () => {
    expect(parseReceiptJson(null)).toBeUndefined();
    expect(parseReceiptJson('{nope')).toBeUndefined();
    expect(parseReceiptJson('{"agentId":"x"}')).toBeUndefined();
  });
});
