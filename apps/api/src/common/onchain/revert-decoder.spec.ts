import { Abis } from '@maroo-chain/viem';
import { okrwToAokrw, type Hex } from '@sikyeoyong/shared';
import { type Abi, encodeErrorResult } from 'viem';
import { describe, expect, it } from 'vitest';
import { ordersAbi } from './orders-abi.js';
import { chainErrorOf, decodeChainFailure, decodeRevert, revertDataOf } from './revert-decoder.js';

const ABI: Abi = [...ordersAbi.filter((i) => i.type === 'error'), ...Abis.errors];
const encode = (errorName: string, args?: readonly unknown[]): Hex =>
  encodeErrorResult({ abi: ABI, errorName, args });

/** A viem-like error: the revert bytes sit a few causes down, under `data`. */
const wrapped = (data: Hex): Error => {
  const inner = Object.assign(new Error('execution reverted'), { data });
  return Object.assign(new Error('call failed'), { cause: inner });
};

describe('revertDataOf', () => {
  it('finds bytes in raw, data and data.data, down the cause chain', () => {
    const d = encode('AgentIsPaused');
    expect(revertDataOf(wrapped(d))).toBe(d);
    expect(revertDataOf({ raw: d })).toBe(d);
    expect(revertDataOf({ cause: { data: { data: d } } })).toBe(d);
  });

  it('is null without bytes (or with too few to be a selector)', () => {
    expect(revertDataOf(new Error('boom'))).toBeNull();
    expect(revertDataOf({ data: '0x' })).toBeNull();
    expect(revertDataOf(undefined)).toBeNull();
  });
});

describe('chainErrorOf and decodeChainFailure (chain-and-pcl.md revert table)', () => {
  it('ExceededAgentTransferLimit is CHAIN_AGENT_LIMIT with the limit as text', () => {
    const e = decodeChainFailure(
      wrapped(encode('ExceededAgentTransferLimit', [okrwToAokrw(5_000n), okrwToAokrw(9_000n)])),
    );
    expect(e).toEqual({ code: 'CHAIN_AGENT_LIMIT', params: { max: '5,000원' } });
  });

  it('ExceededPeriodicVolume is CHAIN_PERIODIC_LIMIT with resetAt in Seoul time', () => {
    // 2026-12-01 03:00:00 UTC is 12:00 in Asia/Seoul.
    const resetAt = BigInt(Date.parse('2026-12-01T03:00:00Z') / 1000);
    const e = decodeChainFailure(
      wrapped(
        encode('ExceededPeriodicVolume', [okrwToAokrw(60_000n), okrwToAokrw(61_000n), resetAt]),
      ),
    );
    expect(e.code).toBe('CHAIN_PERIODIC_LIMIT');
    expect(e.params?.['resetAt']).toContain('12월 1일');
  });

  it.each([
    ['AgentTransferLimitMetadataInvalid', ['empty'], 'CHAIN_AGENT_LIMIT_UNSET'],
    [
      'EasNoAttestationReceived',
      ['0x0000000000000000000000000000000000000001'],
      'CHAIN_EAS_REQUIRED',
    ],
    ['EasAttestationRevoked', ['0x0000000000000000000000000000000000000001'], 'CHAIN_EAS_REQUIRED'],
    ['EasAttestationExpired', ['0x0000000000000000000000000000000000000001'], 'CHAIN_EAS_REQUIRED'],
    ['Unauthorized', undefined, 'CHAIN_UNAUTHORIZED'],
    ['AgentIsPaused', undefined, 'CHAIN_AGENT_PAUSED'],
    ['MerchantNotActive', [7n], 'CHAIN_MERCHANT_INACTIVE'],
    ['VolumeAboveMaxLimit', [1n, 2n], 'CHAIN_KYC_LIMIT'],
    ['OrderExists', [`0x${'ab'.repeat(32)}`], 'CHAIN_ORDER_EXISTS'],
    ['AgentNotBound', undefined, 'CHAIN_AGENT_LIMIT_UNSET'],
    ['NotOperator', undefined, 'CHAIN_UNAUTHORIZED'],
    ['NotAgentOwner', undefined, 'CHAIN_UNAUTHORIZED'],
  ] as const)('%s is %s', (name, args, code) => {
    expect(decodeChainFailure(wrapped(encode(name, args))).code).toBe(code);
  });

  it.each([
    ['BadAmount', undefined],
    ['TransferFailed', undefined],
  ] as const)('%s is not in the table: INTERNAL', (name, args) => {
    expect(decodeChainFailure(wrapped(encode(name, args))).code).toBe('INTERNAL');
  });

  it('a wallet that cannot cover value and gas is CHAIN_INSUFFICIENT_FUNDS', () => {
    const e = Object.assign(new Error('RPC failed'), {
      cause: new Error('insufficient funds for gas * price + value'),
    });
    expect(decodeChainFailure(e)).toEqual({ code: 'CHAIN_INSUFFICIENT_FUNDS' });
  });

  it('anything else is INTERNAL, and an unknown selector too', () => {
    expect(decodeChainFailure(new Error('socket hang up'))).toEqual({ code: 'INTERNAL' });
    expect(decodeChainFailure('x')).toEqual({ code: 'INTERNAL' });
    expect(decodeChainFailure(wrapped('0xdeadbeef'))).toEqual({ code: 'INTERNAL' });
    expect(decodeRevert('0xdeadbeef')).toBeNull();
  });

  it('chainErrorOf reads a decoded revert directly', () => {
    expect(chainErrorOf({ name: 'AgentIsPaused', args: [] }).code).toBe('CHAIN_AGENT_PAUSED');
  });
});
