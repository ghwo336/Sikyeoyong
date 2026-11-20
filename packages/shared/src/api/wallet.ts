import { z } from 'zod';
import { zAokrwString } from '../money/money.js';

/**
 * The wallet screen's money (Wallet.dc.html, GET /api/wallet). owner: the owner's
 * allowance (the custodial ledger while D-24 holds, never below 0); pocket: what the
 * dragon's wallet holds on chain now; savedThisMonth: for now this month's budget minus
 * what was spent, never below 0 (open-questions Q-37 default (a)).
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

/**
 * POST /agents/me/drain (Frozen.dc.html "돌려받기"): how much went back from the dragon's
 * pocket to the owner (aokrw, "0" when the pocket was empty) and the chain transactions.
 */
export const zRefundResult = z
  .object({
    refunded: zAokrwString,
    txHashes: z.array(z.string().regex(/^0x[0-9a-fA-F]{64}$/)),
  })
  .strict();
export type RefundResult = z.infer<typeof zRefundResult>;
