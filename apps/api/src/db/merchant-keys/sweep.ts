import { join } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import { getAddress, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type KeyFile, readArchive, readKeyFile } from './payout-keys.js';

// Owner-run recovery of merchant wallet balances (D-33). Hand-run only: no LLM tool, no API.

export interface SweepKey {
  readonly merchantKey: string;
  readonly address: `0x${string}`;
  readonly privateKey: `0x${string}`;
  /** 'current' = in merchants.json, 'archived' = only in the archive (merchant left the seed). */
  readonly source: 'current' | 'archived';
}

/** What the sweep needs from the chain. The real one wraps viem, tests pass a fake. */
export interface SweepChain {
  balanceOf(address: `0x${string}`): Promise<bigint>;
  gasPrice(): Promise<bigint>;
  /** Gas units for sending `value` from `from` to `to`. */
  estimateGas(from: `0x${string}`, to: `0x${string}`, value: bigint): Promise<bigint>;
  send(args: {
    privateKey: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    gas: bigint;
    gasPrice: bigint;
  }): Promise<string>;
}

export interface SweepRow {
  readonly key: SweepKey;
  readonly balance: bigint;
  /** Fee reserved for the transfer (gas × gas price). 0 when the balance is 0. */
  readonly fee: bigint;
  /** What goes to `--to`: balance minus fee. 0 when skipped. */
  readonly amount: bigint;
  readonly gas: bigint;
  readonly gasPrice: bigint;
  readonly skip: 'zero-balance' | 'insufficient-for-gas' | null;
}

export interface SentRow {
  readonly row: SweepRow;
  readonly txHash: string | null;
  readonly error: string | null;
}

/** Keys from merchants.json plus the archive, one row per private key. Current names win. */
export function loadSweepKeys(keysDir: string): SweepKey[] {
  const out = new Map<string, SweepKey>();
  const add = (merchantKey: string, privateKey: string, source: SweepKey['source']) => {
    if (out.has(privateKey)) return;
    const pk = privateKey as `0x${string}`;
    out.set(privateKey, {
      merchantKey,
      address: privateKeyToAccount(pk).address,
      privateKey: pk,
      source,
    });
  };
  let current: KeyFile = {};
  try {
    current = readKeyFile(join(keysDir, 'merchants.json'));
  } catch (e) {
    // Without merchants.json the archive alone is still enough to recover funds.
    if (!(e instanceof AppError)) throw e;
  }
  for (const [merchantKey, { privateKey }] of Object.entries(current))
    add(merchantKey, privateKey, 'current');
  for (const e of readArchive(join(keysDir, 'archive')))
    add(e.merchantKey, e.privateKey, 'archived');
  return [...out.values()];
}

export function selectKeys(keys: readonly SweepKey[], merchant: string | undefined): SweepKey[] {
  if (merchant === undefined) return [...keys];
  const picked = keys.filter((k) => k.merchantKey === merchant);
  if (picked.length === 0) {
    throw new AppError('VALIDATION_FAILED', { reason: 'no key for that merchant', merchant });
  }
  return picked;
}

/** Checksum-validates the destination. Mixed-case input must carry a correct checksum. */
export function parseDestination(value: string | undefined): `0x${string}` {
  if (value === undefined || value === '') {
    throw new AppError('VALIDATION_FAILED', { reason: '--to is required' });
  }
  if (!isAddress(value, { strict: true })) {
    throw new AppError('VALIDATION_FAILED', { reason: '--to is not a valid checksum address' });
  }
  return getAddress(value);
}

export async function readBalances(
  chain: Pick<SweepChain, 'balanceOf'>,
  keys: readonly SweepKey[],
): Promise<{ key: SweepKey; balance: bigint }[]> {
  const out: { key: SweepKey; balance: bigint }[] = [];
  for (const key of keys) out.push({ key, balance: await chain.balanceOf(key.address) });
  return out;
}

/** Plans one sweep per key: send balance minus gas × price. Nothing is sent here. */
export async function planSweep(
  chain: SweepChain,
  keys: readonly SweepKey[],
  to: `0x${string}`,
): Promise<SweepRow[]> {
  const gasPrice = await chain.gasPrice();
  const rows: SweepRow[] = [];
  for (const key of keys) {
    const balance = await chain.balanceOf(key.address);
    if (balance === 0n) {
      rows.push({ key, balance, fee: 0n, amount: 0n, gas: 0n, gasPrice, skip: 'zero-balance' });
      continue;
    }
    // Estimate with the full balance as value: the fee comes out of it afterwards.
    const gas = await chain.estimateGas(key.address, to, balance);
    const fee = gas * gasPrice;
    if (balance <= fee) {
      rows.push({ key, balance, fee, amount: 0n, gas, gasPrice, skip: 'insufficient-for-gas' });
      continue;
    }
    rows.push({ key, balance, fee, amount: balance - fee, gas, gasPrice, skip: null });
  }
  return rows;
}

/** Sends every non-skipped row once. A failure on one wallet does not stop the others. No retry. */
export async function executeSweep(
  chain: SweepChain,
  rows: readonly SweepRow[],
  to: `0x${string}`,
): Promise<SentRow[]> {
  const out: SentRow[] = [];
  for (const row of rows) {
    if (row.skip !== null) {
      out.push({ row, txHash: null, error: null });
      continue;
    }
    try {
      const txHash = await chain.send({
        privateKey: row.key.privateKey,
        to,
        value: row.amount,
        gas: row.gas,
        gasPrice: row.gasPrice,
      });
      out.push({ row, txHash, error: null });
    } catch (e) {
      // Provider errors can echo the request; keep only the first line and drop key text.
      const msg = e instanceof Error ? (e.message.split('\n')[0] ?? 'send failed') : 'send failed';
      out.push({ row, txHash: null, error: msg.replaceAll(row.key.privateKey, '[key]') });
    }
  }
  return out;
}
