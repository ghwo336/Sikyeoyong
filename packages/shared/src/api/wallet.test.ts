import { describe, expect, it } from 'vitest';
import { zFreezeResult, zIdCardView, zWalletView } from './wallet.js';

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
