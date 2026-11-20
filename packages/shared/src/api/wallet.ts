import { z } from 'zod';
import { zAokrwString } from '../money/money.js';

/**
 * The wallet screen's money (Wallet.dc.html, future GET /wallet). owner: the owner's
 * allowance; pocket: what the dragon holds now; savedThisMonth: what the dragon saved
 * against the usual price this month. The server does not answer this yet (custody
 * of the owner's allowance is open, D-24); only the mock fills it.
 */
export const zWalletView = z
  .object({
    owner: zAokrwString,
    pocket: zAokrwString,
    savedThisMonth: zAokrwString,
  })
  .strict();
export type WalletView = z.infer<typeof zWalletView>;

/**
 * The dragon's ID card (IdCard.dc.html, future GET /agents/me/id-card): the owner's
 * name, whether the owner passed the identity check (D-16), and when the dragon hatched.
 */
export const zIdCardView = z
  .object({
    ownerName: z.string().min(1).max(32),
    ownerVerified: z.boolean(),
    /** unix ms */
    bornAt: z.number().int().nonnegative(),
  })
  .strict();
export type IdCardView = z.infer<typeof zIdCardView>;
