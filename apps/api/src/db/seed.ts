import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError, aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { uuidv7 } from '../common/ids.js';
import { loadConfig } from '../config/env.js';
import { type Db, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { ensurePayoutKeys } from './merchant-keys/payout-keys.js';
import { menus, merchants } from './schema/index.js';

export { ensurePayoutKeys };

// seed/merchants.json (tech-spec 7.1). Prices are whole OKRW in the file, aokrw text in the DB.
const Key = z.string().regex(/^[a-z0-9-]{1,40}$/);
const Menu = z.object({
  key: Key,
  name: z.string().min(1).max(40),
  price: z.number().int().min(1).max(10_000_000),
  tags: z.array(z.string().max(20)).max(10),
});
export const SeedFile = z.object({
  version: z.literal(1),
  merchants: z
    .array(
      z.object({
        key: Key,
        name: z.string().min(1).max(40),
        category: z.string().min(1).max(20),
        tags: z.array(z.string().max(20)).max(10),
        verified: z.boolean(),
        openHours: z.record(z.string(), z.string()),
        menus: z.array(Menu).min(1),
      }),
    )
    .min(1),
});
export type SeedFile = z.infer<typeof SeedFile>;

export function parseSeed(json: unknown): SeedFile {
  const seed = SeedFile.parse(json);
  const keys = seed.merchants.map((m) => m.key);
  if (new Set(keys).size !== keys.length)
    throw new AppError('INTERNAL', { reason: 'duplicate merchant key in seed' });
  for (const m of seed.merchants) {
    const menuKeys = m.menus.map((x) => x.key);
    if (new Set(menuKeys).size !== menuKeys.length)
      throw new AppError('INTERNAL', { reason: 'duplicate menu key in seed', merchant: m.key });
  }
  return seed;
}

export interface SeedResult {
  readonly inserted: number;
  readonly skipped: number;
}

/**
 * Loads merchants and menus into the DB. Idempotent: a merchant whose payout address is
 * already present is skipped with its menus (tech-spec 7.1 "이미 등록된 가게는 건너뛴다").
 * Unverified merchants go in with verified=false and no onchain id (scene 6).
 */
export function seedMerchants(
  db: Db,
  seed: SeedFile,
  payoutByKey: ReadonlyMap<string, string>,
  publicBaseUrl: string,
  nowMs: number = Date.now(),
): SeedResult {
  let inserted = 0;
  let skipped = 0;
  // Step the timestamp per row so UUID v7 order follows insert order within one run.
  let clock = nowMs;
  const nextId = () => uuidv7(clock++);
  db.transaction((tx) => {
    for (const m of seed.merchants) {
      const payout = payoutByKey.get(m.key);
      if (!payout)
        throw new AppError('INTERNAL', { reason: 'missing payout address', merchant: m.key });
      const found = tx
        .select({ id: merchants.id })
        .from(merchants)
        .where(eq(merchants.payoutAddress, payout))
        .get();
      if (found) {
        skipped += 1;
        continue;
      }
      const id = nextId();
      tx.insert(merchants)
        .values({
          id,
          name: m.name,
          category: m.category,
          tagsJson: JSON.stringify(m.tags),
          payoutAddress: payout,
          verified: m.verified,
          active: true,
          metadataUri: `${publicBaseUrl.replace(/\/$/, '')}/api/merchants/${id}/meta.json`,
          openHoursJson: JSON.stringify(m.openHours),
          source: 'seed',
          createdAt: nowMs,
        })
        .run();
      for (const menu of m.menus) {
        tx.insert(menus)
          .values({
            id: nextId(),
            merchantId: id,
            name: menu.name,
            priceAokrw: aokrwToString(okrwToAokrw(BigInt(menu.price))),
            tagsJson: JSON.stringify(menu.tags),
          })
          .run();
      }
      inserted += 1;
    }
  });
  return { inserted, skipped };
}

// `pnpm db:seed` entry. Paths are relative to the repo root.
if (require.main === module) {
  const root = resolve(__dirname, '../../../..');
  const envFile = resolve(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const config = loadConfig(process.env);
  const seed = parseSeed(JSON.parse(readFileSync(resolve(root, 'seed/merchants.json'), 'utf8')));
  const payouts = ensurePayoutKeys(
    resolve(root, 'seed/.keys/merchants.json'),
    seed.merchants.map((m) => m.key),
  );
  const handle = openDb(config.databaseUrl);
  runMigrations(handle.db);
  const result = seedMerchants(handle.db, seed, payouts, config.publicBaseUrl);
  handle.close();
  console.warn(`seed: inserted ${result.inserted}, skipped ${result.skipped}`);
}
