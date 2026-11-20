import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/index.js';
import { findDeployment, parseDeployment, resolveOrdersContract } from './deployments.js';
import { DEPLOYMENTS } from './deployments-data.js';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const H = '0x' + '1'.repeat(64);

function raw(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chainId: 450815,
    profile: 'demo',
    deployedAt: '2026-11-21',
    operator: A,
    implementation: A,
    proxy: B,
    deployBlock: 12,
    txs: { implementation: H, proxy: H, policies: H },
    blocks: { implementation: 11, proxy: 12, policies: 13 },
    policyHash: H,
    policies: [
      {
        selector: '0x12345678',
        signature: 'placeOrder(uint64,bytes32)',
        root: 'LOGICAL_POLICY',
        quantifier: 'And',
        children: [{ template: 'AGENT_OKRW_TRANSFER_LIMIT_POLICY', value: {} }],
      },
    ],
    ...over,
  };
}

describe('parseDeployment', () => {
  it('accepts a complete record', () => {
    const r = parseDeployment(raw());
    expect(r.proxy).toBe(B);
    expect(r.profile).toBe('demo');
  });

  it.each([
    ['bad proxy address', { proxy: '0x12' }],
    ['unknown profile', { profile: 'staging' }],
    ['bad tx hash', { txs: { implementation: H, proxy: 'nope', policies: H } }],
    ['negative block', { deployBlock: -1 }],
    ['bad date', { deployedAt: '21/11/2026' }],
  ])('rejects %s', (_name, over) => {
    expect(() => parseDeployment(raw(over))).toThrow(AppError);
  });
});

describe('resolveOrdersContract', () => {
  const records = [parseDeployment(raw())];

  it('finds the record by chain and profile', () => {
    expect(findDeployment(records, 450815, 'demo')?.proxy).toBe(B);
    expect(findDeployment(records, 450815, 'default')).toBeNull();
    expect(findDeployment(records, 1, 'demo')).toBeNull();
  });

  it('returns the proxy of the record', () => {
    expect(resolveOrdersContract(records, 450815, 'demo')).toBe(B);
  });

  it('lets the env override win, and rejects a malformed override', () => {
    expect(resolveOrdersContract(records, 450815, 'demo', A)).toBe(A);
    expect(() => resolveOrdersContract(records, 450815, 'demo', '0xcontract')).toThrow(AppError);
  });

  it('treats an empty override as unset', () => {
    expect(resolveOrdersContract(records, 450815, 'demo', '')).toBe(B);
  });

  it('throws when nothing was deployed for the profile', () => {
    expect(() => resolveOrdersContract(records, 450815, 'default')).toThrow(AppError);
  });
});

describe('DEPLOYMENTS registry', () => {
  it('holds only valid records, one per chain and profile', () => {
    const keys = DEPLOYMENTS.map((d) => `${d.chainId}.${d.profile}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
