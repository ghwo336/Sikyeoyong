import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { AppError, parseMerchantOnchain, type MerchantOnchainRecord } from '@sikyeoyong/shared';
import { eq, sql } from 'drizzle-orm';
import { loadConfig } from '../config/env.js';
import { type Db, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { merchants } from './schema/index.js';

export interface OnchainSyncResult {
  readonly updated: number;
  readonly unchanged: number;
  /** Record entries whose payout address is not in this DB (a DB seeded without that merchant). */
  readonly missing: number;
}

/**
 * Copies onchain merchant ids from the record file into merchants.onchain_id (D-33). Matches by
 * payout address (stable across DBs; the DB row id differs per seed run). Idempotent. A row that
 * already holds another id is a conflict and stops the run: ids never change silently.
 */
export function syncOnchainIds(db: Db, record: MerchantOnchainRecord): OnchainSyncResult {
  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  db.transaction((tx) => {
    for (const entry of record.merchants) {
      const row = tx
        .select({ id: merchants.id, onchainId: merchants.onchainId })
        .from(merchants)
        .where(sql`lower(${merchants.payoutAddress}) = ${entry.payout.toLowerCase()}`)
        .get();
      if (!row) {
        missing += 1;
        continue;
      }
      if (row.onchainId === entry.onchainId) {
        unchanged += 1;
        continue;
      }
      if (row.onchainId !== null) {
        throw new AppError('INTERNAL', {
          reason: 'merchant already has a different onchain id',
          merchant: entry.merchantKey,
        });
      }
      tx.update(merchants)
        .set({ onchainId: entry.onchainId })
        .where(eq(merchants.id, row.id))
        .run();
      updated += 1;
    }
  });
  return { updated, unchanged, missing };
}

export function readOnchainRecord(path: string): MerchantOnchainRecord | null {
  if (!existsSync(path)) return null;
  const record = parseMerchantOnchain(JSON.parse(readFileSync(path, 'utf8')));
  // The file name is `<chainId>.<profile>.json`; a record under the wrong name is never applied.
  const expected = `${record.chainId}.${record.profile}.json`;
  if (basename(path) !== expected) {
    throw new AppError('INTERNAL', {
      reason: 'onchain record does not match its file name',
      file: basename(path),
      expected,
    });
  }
  return record;
}

export function onchainRecordPath(root: string, chainId: number, profile: string): string {
  return resolve(root, 'seed/onchain', `${chainId}.${profile}.json`);
}

/** Sync from the record of this chain and profile, if there is one. Used by db:seed too. */
export function syncFromRecordFile(
  db: Db,
  root: string,
  chainId: number,
  profile: string,
): OnchainSyncResult | null {
  const record = readOnchainRecord(onchainRecordPath(root, chainId, profile));
  return record === null ? null : syncOnchainIds(db, record);
}

// `pnpm merchants:sync-onchain` entry. Uses DATABASE_URL, CHAIN_ID and POLICY_PROFILE like the API.
if (require.main === module) {
  const root = resolve(__dirname, '../../../..');
  const envFile = resolve(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const config = loadConfig(process.env);
  const handle = openDb(config.databaseUrl);
  runMigrations(handle.db);
  const r = syncFromRecordFile(handle.db, root, config.chain.chainId, config.policy.profile);
  handle.close();
  console.warn(
    r === null
      ? 'sync-onchain: no record file for this chain and profile'
      : `sync-onchain: updated ${r.updated}, unchanged ${r.unchanged}, not in this DB ${r.missing}`,
  );
}
