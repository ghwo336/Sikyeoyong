import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, zBudgetView } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, merchants, orders, users } from '../../db/schema/index.js';
import { CHAIN_READER, type ChainReader } from '../chain/chain.service.js';
import { BudgetModule } from './budget.module.js';
import { BudgetService } from './budget.service.js';

const NOW = Date.parse('2026-12-10T03:00:00.000Z'); // 12:00 KST Dec 10
const WALLET = `0x${'ab'.repeat(20)}` as const;
const s = (won: bigint) => okrwToAokrw(won).toString();

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

async function setup(chain: ChainReader, env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', monthlyBudgetAokrw: s(300_000n), createdAt: 1 })
    .run();
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '용이',
      dragonSpecies: 'star',
      paymentPath: 'B',
      level: 2,
      walletAddress: WALLET,
      status: 'ACTIVE',
      createdAt: 1,
    })
    .run();
  h.db
    .insert(merchants)
    .values({
      id: 'm1',
      name: '국밥',
      category: 'korean',
      payoutAddress: '0x1',
      metadataUri: 'https://x.test',
      source: 'seed',
      createdAt: 1,
    })
    .run();
  h.db
    .insert(orders)
    .values({
      id: 'o1',
      orderRef: `0x${'1'.repeat(64)}`,
      userId: 'u1',
      agentId: 'a1',
      merchantId: 'm1',
      amountAokrw: s(219_000n),
      itemsJson: '[]',
      status: 'delivered',
      createdAt: NOW - 1000,
      updatedAt: NOW,
    })
    .run();
  const moduleRef = await Test.createTestingModule({ imports: [BudgetModule] })
    .overrideProvider(CHAIN_READER)
    .useValue(chain)
    .useMocker((token) => {
      if (token === APP_CONFIG) return loadConfig(env);
      if (token === DB) return h;
      return undefined;
    })
    .compile();
  return { h, budget: moduleRef.get(BudgetService) };
}

const chainOf = (usedOkrw: bigint, resetAtSec: number | null): ChainReader => ({
  periodicVolume: (wallet) => {
    expect(wallet).toBe(WALLET);
    return Promise.resolve({ usedAokrw: okrwToAokrw(usedOkrw), resetAtSec });
  },
});

describe('BudgetService.getView (tech-spec 3.2, 3.7)', () => {
  it('builds a BudgetView from the user, the dragon, this month orders and the chain', async () => {
    const { budget } = await setup(chainOf(219_000n, 1_767_225_600));
    const view = await budget.getView('u1', NOW);
    expect(zBudgetView.parse(view)).toEqual({
      monthKst: '2026-12',
      personalBudget: s(300_000n),
      personalSpent: s(219_000n),
      nagLevel: 'warn70', // 73%
      chainCap: s(500_000n),
      chainUsed: s(219_000n),
      chainResetAtSec: 1_767_225_600,
      level: 2,
      perOrderLimit: s(30_000n),
      frozen: false,
      budgetOptions: [
        { id: 'small', amount: s(200_000n) },
        { id: 'medium', amount: s(300_000n) },
        { id: 'large', amount: s(500_000n) },
      ],
    });
  });

  it('uses the demo profile cap when POLICY_PROFILE=demo', async () => {
    const { budget } = await setup(chainOf(0n, null), { POLICY_PROFILE: 'demo' });
    const view = await budget.getView('u1', NOW);
    expect(view.chainCap).toBe(s(60_000n));
    expect(view.chainResetAtSec).toBeNull();
  });

  it('shows frozen and counts the month in KST, not UTC', async () => {
    const { h, budget } = await setup(chainOf(0n, null));
    h.db.update(agents).set({ status: 'FROZEN' }).run();
    // 2027-01-01 00:30 KST is still Dec 31 in UTC: the December order no longer counts.
    const view = await budget.getView('u1', Date.parse('2026-12-31T15:30:00.000Z'));
    expect(view.monthKst).toBe('2027-01');
    expect(view.personalSpent).toBe('0');
    expect(view.nagLevel).toBe('none');
    expect(view.frozen).toBe(true);
    h.db.update(orders).set({ status: 'refunded' }).where(eq(orders.id, 'o1')).run();
  });

  it('passes chain errors through instead of making up numbers', async () => {
    const failing: ChainReader = { periodicVolume: () => Promise.reject(new Error('rpc down')) };
    const { budget } = await setup(failing);
    await expect(budget.getView('u1', NOW)).rejects.toThrow('rpc down');
  });
});
