import { describe, expect, it } from 'vitest';
import { zFreezeResult, zIdCardView, zRefundResult, zTrialResult, zWalletView } from './wallet.js';

describe('zWalletView', () => {
  it('reads aokrw strings only', () => {
    const v = {
      owner: '81000000000000000000000',
      pocket: '20000000000000000000000',
      savedThisMonth: '32000000000000000000000',
    };
    expect(zWalletView.parse(v)).toEqual(v);
    expect(zWalletView.safeParse({ ...v, owner: 81000 }).success).toBe(false);
    expect(zWalletView.safeParse({ ...v, extra: '1' }).success).toBe(false);
  });
});

describe('zIdCardView', () => {
  it('reads the owner, the check and the birth time', () => {
    const v = { ownerName: '이호재', ownerVerified: true, bornAt: 1_764_547_200_000 };
    expect(zIdCardView.parse(v)).toEqual(v);
    expect(zIdCardView.safeParse({ ...v, ownerName: '' }).success).toBe(false);
    expect(zIdCardView.safeParse({ ...v, bornAt: -1 }).success).toBe(false);
  });
});

describe('zFreezeResult', () => {
  it('takes the state and 32-byte tx hashes only', () => {
    const v = { frozen: true, txHashes: [`0x${'a'.repeat(64)}`] };
    expect(zFreezeResult.parse(v)).toEqual(v);
    expect(zFreezeResult.parse({ frozen: false, txHashes: [] })).toEqual({
      frozen: false,
      txHashes: [],
    });
    expect(zFreezeResult.safeParse({ ...v, txHashes: ['0x1234'] }).success).toBe(false);
    expect(zFreezeResult.safeParse({ ...v, agent: {} }).success).toBe(false);
  });
});

describe('zRefundResult', () => {
  it('reads the refunded amount as an aokrw string only', () => {
    const v = { refunded: '20000000000000000000000', txHashes: [`0x${'b'.repeat(64)}`] };
    expect(zRefundResult.parse(v)).toEqual(v);
    expect(zRefundResult.parse({ refunded: '0', txHashes: [] })).toEqual({
      refunded: '0',
      txHashes: [],
    });
    expect(zRefundResult.safeParse({ ...v, refunded: 20000 }).success).toBe(false);
    expect(zRefundResult.safeParse({ ...v, refunded: '1.5' }).success).toBe(false);
  });
});

describe('zTrialResult', () => {
  it('is granted true or false, nothing else', () => {
    expect(zTrialResult.parse({ granted: true })).toEqual({ granted: true });
    expect(zTrialResult.safeParse({ granted: 'yes' }).success).toBe(false);
    expect(zTrialResult.safeParse({ granted: true, amount: '1' }).success).toBe(false);
  });
});
