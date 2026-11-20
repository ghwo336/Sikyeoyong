import { policy } from '@maroo-chain/viem';
import { getPolicy } from '@sikyeoyong/shared';
import { toFunctionSelector } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  PLACE_ORDER_SIGNATURE,
  REGISTER_MERCHANT_SIGNATURE,
  buildOrdersPolicies,
  diffPolicies,
  policyHash,
  summarizePolicies,
} from './policies.ts';

const KYB = {
  easContract: '0x1000000000000000000000000000000000000007',
  indexContract: '0x1000000000000000000000000000000000000008',
  schemaUid: `0x${'ab'.repeat(32)}`,
} as const;

describe('buildOrdersPolicies', () => {
  it('demo: placeOrder only, And of the agent limit and the periodic cap, no EAS (D-33)', () => {
    const raw = buildOrdersPolicies({ profile: 'demo', okrwDenom: 'atokrw' });
    expect(raw).toHaveLength(1);
    expect(raw[0]?.selector).toBe(toFunctionSelector(PLACE_ORDER_SIGNATURE));
    const [s] = summarizePolicies(raw);
    expect(s?.root).toBe('LOGICAL_POLICY');
    expect(s?.quantifier).toBe('And');
    expect(s?.children.map((c) => c.template)).toEqual([
      'AGENT_OKRW_TRANSFER_LIMIT_POLICY',
      'PERIODIC_VOLUME_POLICY',
    ]);
    const cap = getPolicy('demo');
    const periodic = s?.children[1]?.value['limits'] ?? '';
    expect(periodic).toContain(cap.periodicCapAokrw.toString());
    expect(periodic).toContain('"resetPeriodSeconds":"3600"');
    expect(periodic).toContain('atokrw');
  });

  it('default: adds EAS on registerMerchant only', () => {
    const raw = buildOrdersPolicies({ profile: 'default', okrwDenom: 'atokrw', kyb: KYB });
    expect(raw.map((r) => r.selector)).toEqual([
      toFunctionSelector(PLACE_ORDER_SIGNATURE),
      toFunctionSelector(REGISTER_MERCHANT_SIGNATURE),
    ]);
    expect(summarizePolicies(raw)[1]?.children[0]?.template).toBe('EAS_POLICY');
  });

  it('default without a KYB schema refuses to build', () => {
    expect(() => buildOrdersPolicies({ profile: 'default', okrwDenom: 'atokrw' })).toThrow();
  });

  it('never uses an empty selector', () => {
    for (const r of buildOrdersPolicies({ profile: 'default', okrwDenom: 'atokrw', kyb: KYB })) {
      expect(r.selector).not.toBe('0x');
    }
  });
});

describe('diffPolicies', () => {
  const wanted = buildOrdersPolicies({ profile: 'demo', okrwDenom: 'atokrw' });

  it('same when equal, and the hash ignores order', () => {
    expect(diffPolicies(wanted, wanted).same).toBe(true);
    expect(policyHash(wanted)).toBe(policyHash([...wanted].reverse()));
  });

  it('catches a policy that a full replace would drop', () => {
    const extra = policy.agentOkrwTransferLimit({ selector: '0xdeadbeef' });
    const d = diffPolicies([...wanted, extra], wanted);
    expect(d.same).toBe(false);
    expect(d.unmanaged).toEqual(['0xdeadbeef']);
  });

  it('catches missing and changed', () => {
    expect(diffPolicies([], wanted).missing).toEqual([toFunctionSelector(PLACE_ORDER_SIGNATURE)]);
    const other = buildOrdersPolicies({ profile: 'default', okrwDenom: 'atokrw', kyb: KYB });
    expect(diffPolicies(other, wanted).changed).toEqual([
      toFunctionSelector(PLACE_ORDER_SIGNATURE),
    ]);
  });
});
