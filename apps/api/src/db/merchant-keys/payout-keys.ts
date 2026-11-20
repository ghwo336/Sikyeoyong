import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';

// Merchant payout keys (D-33): seed/.keys/merchants.json is the live file; seed/.keys/archive
// holds an append-only copy of every key ever created, so no key is ever lost.

const MerchantKey = z.string().regex(/^[a-z0-9-]{1,40}$/);
const PrivateKey = z.string().regex(/^0x[0-9a-f]{64}$/);
const KeyFileSchema = z.record(MerchantKey, z.object({ privateKey: PrivateKey }));
const ArchiveLine = z.object({
  merchantKey: MerchantKey,
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  privateKey: PrivateKey,
  createdAt: z.number().int(),
});

export type KeyFile = z.infer<typeof KeyFileSchema>;
export type ArchiveEntry = z.infer<typeof ArchiveLine>;
export const ARCHIVE_FILE = 'keys.jsonl';

function readText(path: string, what: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new AppError('INTERNAL', { reason: `${what} cannot be read`, path });
  }
}

/**
 * Reads the key file without ever letting key material reach an error message:
 * a JSON SyntaxError quotes the broken line, so the original error and cause are dropped.
 */
export function readKeyFile(path: string): KeyFile {
  const raw = readText(path, 'payout key file');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError('INTERNAL', { reason: 'payout key file is not valid JSON', path });
  }
  const parsed = KeyFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError('INTERNAL', { reason: 'payout key file has an unexpected shape', path });
  }
  return parsed.data;
}

export function archivePath(archiveDir: string): string {
  return join(archiveDir, ARCHIVE_FILE);
}

/** All archived keys, oldest first. Missing archive means none. Errors never quote key text. */
export function readArchive(archiveDir: string): ArchiveEntry[] {
  const path = archivePath(archiveDir);
  if (!existsSync(path)) return [];
  const out: ArchiveEntry[] = [];
  for (const line of readText(path, 'key archive').split('\n')) {
    if (line.trim() === '') continue;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      throw new AppError('INTERNAL', { reason: 'key archive has an invalid line', path });
    }
    const parsed = ArchiveLine.safeParse(json);
    if (!parsed.success) {
      throw new AppError('INTERNAL', { reason: 'key archive has an unexpected shape', path });
    }
    out.push(parsed.data);
  }
  return out;
}

/**
 * Appends keys the archive does not hold yet (matched by private key). Existing lines are never
 * rewritten or removed. Directory mode 700, file mode 600.
 */
export function appendToArchive(
  archiveDir: string,
  keys: KeyFile,
  nowMs: number = Date.now(),
): number {
  const known = new Set(readArchive(archiveDir).map((e) => e.privateKey));
  const lines: string[] = [];
  for (const [merchantKey, { privateKey }] of Object.entries(keys)) {
    if (known.has(privateKey)) continue;
    known.add(privateKey);
    const address = privateKeyToAccount(privateKey as `0x${string}`).address;
    lines.push(`${JSON.stringify({ merchantKey, address, privateKey, createdAt: nowMs })}\n`);
  }
  if (lines.length === 0) return 0;
  mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  chmodSync(archiveDir, 0o700);
  const path = archivePath(archiveDir);
  appendFileSync(path, lines.join(''), { mode: 0o600 });
  chmodSync(path, 0o600);
  return lines.length;
}

/**
 * One testnet payout key per merchant (tech-spec 7.1 step 1), kept in seed/.keys (gitignored,
 * mode 600). Missing keys are created; existing ones are reused so addresses stay stable.
 * Every key is also appended to the archive BEFORE the live file is replaced (D-33).
 * Returns addresses only. Keys are never printed.
 */
export function ensurePayoutKeys(
  keyFilePath: string,
  merchantKeys: readonly string[],
  archiveDir: string = join(dirname(keyFilePath), 'archive'),
): Map<string, string> {
  const stored = existsSync(keyFilePath) ? readKeyFile(keyFilePath) : {};
  let changed = false;
  for (const key of merchantKeys) {
    if (!stored[key]) {
      stored[key] = { privateKey: generatePrivateKey() };
      changed = true;
    }
  }
  // Also backfills keys that predate the archive.
  appendToArchive(archiveDir, stored);
  if (changed) {
    // Write a temp file with 600 then rename, so a crash never leaves a truncated key file.
    mkdirSync(dirname(keyFilePath), { recursive: true });
    const tmp = `${keyFilePath}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, keyFilePath);
  }
  return new Map(
    merchantKeys.map((key) => {
      const entry = stored[key];
      if (!entry) throw new AppError('INTERNAL', { reason: 'missing payout key', merchant: key });
      return [key, privateKeyToAccount(entry.privateKey as `0x${string}`).address];
    }),
  );
}
