import { z } from 'zod';
import { AppError } from '../errors/index.js';
import { isPolicyProfile, type PolicyProfile } from './policy.js';

/**
 * Onchain merchant record (`seed/onchain/<chainId>.<profile>.json`, D-33). `pnpm merchants:register`
 * writes it after each merchant is registered and activated; `pnpm merchants:sync-onchain` copies
 * the ids into the merchants table. Addresses, ids and hashes are public. It holds no keys.
 * This module only parses and merges. It reads no files.
 */
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const blockNumber = z.number().int().nonnegative();

export const merchantOnchainEntrySchema = z.object({
  merchantKey: z.string().regex(/^[a-z0-9-]{1,40}$/),
  /** uint64 merchantId from the MerchantRegistered event, as decimal text (never a number). */
  onchainId: z.string().regex(/^[1-9][0-9]{0,19}$/),
  payout: address,
  metadataUri: z.string().min(1),
  txs: z.object({
    /** Gas money sent by the operator, null when the payout wallet already had enough. */
    fund: txHash.nullable(),
    register: txHash,
    activate: txHash,
  }),
  blocks: z.object({ register: blockNumber, activate: blockNumber }),
});

export const merchantOnchainSchema = z.object({
  chainId: z.number().int().positive(),
  profile: z.string().refine(isPolicyProfile, 'unknown profile'),
  proxy: address,
  merchants: z.array(merchantOnchainEntrySchema),
});

export type MerchantOnchainEntry = z.infer<typeof merchantOnchainEntrySchema>;
export type MerchantOnchainRecord = Omit<z.infer<typeof merchantOnchainSchema>, 'profile'> & {
  readonly profile: PolicyProfile;
};

export function parseMerchantOnchain(raw: unknown): MerchantOnchainRecord {
  const parsed = merchantOnchainSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError('INTERNAL', {
      reason: 'invalid merchant onchain record',
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const seenPayouts = new Set<string>();
  for (const m of parsed.data.merchants) {
    const payout = m.payout.toLowerCase();
    if (seenKeys.has(m.merchantKey) || seenIds.has(m.onchainId) || seenPayouts.has(payout)) {
      throw new AppError('INTERNAL', {
        reason: 'duplicate merchant in onchain record',
        merchant: m.merchantKey,
      });
    }
    seenKeys.add(m.merchantKey);
    seenIds.add(m.onchainId);
    seenPayouts.add(payout);
  }
  return parsed.data;
}

/** Adds or replaces one entry by merchantKey, keeping the list sorted by onchain id. */
export function withMerchantEntry(
  record: MerchantOnchainRecord,
  entry: MerchantOnchainEntry,
): MerchantOnchainRecord {
  const rest = record.merchants.filter((m) => m.merchantKey !== entry.merchantKey);
  const merchants = [...rest, entry].sort((a, b) => {
    const x = BigInt(a.onchainId);
    const y = BigInt(b.onchainId);
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return parseMerchantOnchain({ ...record, merchants });
}
