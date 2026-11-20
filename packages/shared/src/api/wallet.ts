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

/**
 * POST /agents/me/freeze and /agents/me/unfreeze (tech-spec 3.2, Wallet.dc.html "용이 멈추기",
 * Frozen.dc.html "깨우기"): the dragon's state now and the chain transactions that paused or
 * resumed it (setAgentPaused through the owner port, D-24).
 */
export const zFreezeResult = z
  .object({
    frozen: z.boolean(),
    txHashes: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  })
  .strict();
export type FreezeResult = z.infer<typeof zFreezeResult>;
