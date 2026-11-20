import { okrwToAokrw } from '@sikyeoyong/shared';
import type { Db } from '../db/client.js';
import { agents, menus, merchants, users } from '../db/schema/index.js';

/*
 * Test rows written by hand, shared by the merchants, recommend and llm specs.
 * Prices are whole won here and stored as aokrw text like the seed does.
 * Not part of the build (tsconfig.build.json excludes src/test).
 */

export function insertUser(
  db: Db,
  id: string,
  opts: { budgetWon?: bigint; level?: 1 | 2 | 3; dong?: string | null; frozen?: boolean } = {},
): void {
  db.insert(users)
    .values({
      id,
      nickname: id,
      addressDong: opts.dong ?? null,
      monthlyBudgetAokrw: okrwToAokrw(opts.budgetWon ?? 300_000n).toString(),
      createdAt: 1,
    })
    .run();
  db.insert(agents)
    .values({
      id: `a-${id}`,
      userId: id,
      dragonName: '용이',
      dragonSpecies: 'forest',
      paymentPath: 'B',
      level: opts.level ?? 1,
      status: opts.frozen === true ? 'FROZEN' : 'ACTIVE',
      createdAt: 1,
    })
    .run();
}

let payoutSeq = 0;

export function insertMerchant(
  db: Db,
  id: string,
  opts: {
    name?: string;
    category?: string;
    tags?: string[];
    verified?: boolean;
    active?: boolean;
    openHours?: Record<string, string>;
  } = {},
): void {
  payoutSeq += 1;
  db.insert(merchants)
    .values({
      id,
      name: opts.name ?? id,
      category: opts.category ?? '한식',
      tagsJson: JSON.stringify(opts.tags ?? []),
      payoutAddress: `0x${payoutSeq.toString(16).padStart(40, '0')}`,
      verified: opts.verified ?? true,
      active: opts.active ?? true,
      metadataUri: `http://localhost/api/merchants/${id}/meta.json`,
      openHoursJson: JSON.stringify(opts.openHours ?? { 'mon-sun': '00:00-24:00' }),
      source: 'seed',
      createdAt: 1,
    })
    .run();
}

export function insertMenu(
  db: Db,
  id: string,
  merchantId: string,
  priceWon: bigint,
  opts: { name?: string; tags?: string[]; description?: string; available?: boolean } = {},
): void {
  db.insert(menus)
    .values({
      id,
      merchantId,
      name: opts.name ?? id,
      priceAokrw: okrwToAokrw(priceWon).toString(),
      tagsJson: JSON.stringify(opts.tags ?? []),
      description: opts.description ?? '',
      available: opts.available ?? true,
    })
    .run();
}
