import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  isNetworkKey,
  isPolicyProfile,
  type NetworkKey,
  type PolicyProfile,
} from '@sikyeoyong/shared';
import { parseAbi, type Hex } from 'viem';

/**
 * Pure parts of `pnpm merchants:register` (D-33): argument parsing, the funding amount, the seed
 * and key readers. Nothing here sends a transaction. Errors never quote key material.
 */
export const MERCHANT_ABI = parseAbi([
  'function registerMerchant(bytes32 kybUid, string metadataURI) returns (uint64 merchantId)',
  'function setMerchantStatus(uint64 merchantId, uint8 status)',
  'function merchantIdByPayout(address payout) view returns (uint64)',
  'function merchants(uint64 merchantId) view returns (address payout, bytes32 kybUid, uint8 status, string metadataURI)',
  'event MerchantRegistered(uint64 indexed merchantId, address indexed payout, bytes32 kybUid, string metadataURI)',
  'event MerchantStatusChanged(uint64 indexed merchantId, uint8 status)',
]);

/** MerchantStatus enum of SikyeoyongOrders: None, Pending, Active, Suspended. */
export const STATUS_PENDING = 1;
export const STATUS_ACTIVE = 2;

export interface RegisterArgs {
  readonly network: NetworkKey;
  readonly profile: PolicyProfile;
  /** Directory or file of payout keys (seed/.keys/merchants.json). */
  readonly keys: string;
  /** Seed file with the merchant list (seed/merchants.json). */
  readonly seed: string;
  /** SQLite file the metadata URLs are read from (read only). */
  readonly db: string;
  /** Output record, default seed/onchain/<chainId>.<profile>.json. */
  readonly out: string | undefined;
  readonly dryRun: boolean;
  readonly maxSpendOkrw: bigint;
  /** Only these merchant keys, for a first small try. */
  readonly only: readonly string[];
}

const FLAGS = new Set(['--dry-run']);
const VALUES = new Set([
  '--profile',
  '--network',
  '--keys',
  '--seed',
  '--db',
  '--out',
  '--max-spend',
  '--only',
]);

export function parseRegisterArgs(argv: readonly string[]): RegisterArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (FLAGS.has(arg)) flags.add(arg);
    else if (VALUES.has(arg)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      values.set(arg, next);
      i += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  const profile = values.get('--profile') ?? 'demo';
  if (!isPolicyProfile(profile)) throw new Error(`unknown profile: ${profile}`);
  const network = values.get('--network') ?? 'maroo-testnet';
  if (!isNetworkKey(network)) throw new Error(`unknown network: ${network}`);
  const spend = values.get('--max-spend') ?? '250';
  if (!/^[1-9][0-9]{0,6}$/.test(spend)) throw new Error('--max-spend must be a whole OKRW amount');
  const keys = values.get('--keys');
  if (keys === undefined) throw new Error('--keys <seed/.keys/merchants.json> is required');
  const db = values.get('--db');
  if (db === undefined) throw new Error('--db <sqlite file> is required');
  const only = (values.get('--only') ?? '').split(',').filter((k) => k !== '');
  return {
    network,
    profile,
    keys,
    seed: values.get('--seed') ?? 'seed/merchants.json',
    db,
    out: values.get('--out'),
    dryRun: flags.has('--dry-run'),
    maxSpendOkrw: BigInt(spend),
    only,
  };
}

/**
 * Balance the payout wallet must hold before registering: the gas estimate times the max fee per
 * gas the chain quotes (estimateFeesPerGas, above getGasPrice) with a 10 percent margin. The node
 * checks gas limit times max fee against the balance before it runs the call.
 */
export function requiredGasMoney(gasEstimate: bigint, maxFeePerGas: bigint): bigint {
  return (gasEstimate * maxFeePerGas * 11n) / 10n;
}

/** How much the operator must send so the wallet reaches the required balance, 0 if enough. */
export function topUpAmount(required: bigint, balance: bigint): bigint {
  return balance >= required ? 0n : required - balance;
}

export interface SeedMerchant {
  readonly key: string;
  readonly verified: boolean;
}

/** Merchant keys and verified flags from seed/merchants.json. */
export function readSeedMerchants(path: string): SeedMerchant[] {
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    merchants?: { key?: unknown; verified?: unknown }[];
  };
  if (!Array.isArray(json.merchants)) throw new Error('seed file has no merchants');
  return json.merchants.map((m) => {
    if (typeof m.key !== 'string' || typeof m.verified !== 'boolean')
      throw new Error('seed merchant has an unexpected shape');
    return { key: m.key, verified: m.verified };
  });
}

/** merchantKey to private key. The error never includes the file text. */
export function readPayoutKeys(path: string): Map<string, Hex> {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('payout key file cannot be read as JSON');
  }
  const out = new Map<string, Hex>();
  if (typeof json !== 'object' || json === null) throw new Error('payout key file shape');
  for (const [key, value] of Object.entries(json)) {
    const pk = (value as { privateKey?: unknown } | null)?.privateKey;
    if (typeof pk !== 'string' || !/^0x[0-9a-f]{64}$/.test(pk))
      throw new Error(`payout key for ${key} has an unexpected shape`);
    out.set(key, pk as Hex);
  }
  return out;
}

/** payout address (lowercase) to metadata URL, read only from the API's SQLite file. */
export function readMetadataUris(dbPath: string): Map<string, string> {
  if (!existsSync(dbPath)) throw new Error(`db file not found: ${dbPath}`);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare('select payout_address, metadata_uri from merchants').all() as {
      payout_address: string;
      metadata_uri: string;
    }[];
    return new Map(rows.map((r) => [r.payout_address.toLowerCase(), r.metadata_uri]));
  } finally {
    db.close();
  }
}
