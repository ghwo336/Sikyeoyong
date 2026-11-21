import { getPolicy, type Hex, okrwToAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, merchants, orders, ownerAllowanceEntries, users } from '../../db/schema/index.js';
import { MockChainStateRepository } from './mock-chain-state.repository.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { createPaymentProvider } from './payment.service.js';

const won = (n: bigint) => okrwToAokrw(n);
const T0 = Date.parse('2026-12-01T03:00:00.000Z');
const REF = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

/** A new process: a new provider that only knows the database. */
function boot(h: DbHandle): MockPaymentProvider {
  const p = new MockPaymentProvider(getPolicy('default'), () => T0);
  p.restore(new MockChainStateRepository(h).snapshot());
  return p;
}

function seed(): DbHandle {
  const h = openDb(':memory:');
  handles.push(h);
  runMigrations(h.db);
  h.db
    .insert(users)
    .values({
      id: 'u1',
      nickname: 'a',
      myPeriodicLimitAokrw: won(300_000n).toString(),
      createdAt: 1,
    })
    .run();
  h.db
    .insert(merchants)
    .values({
      id: 'm1',
      name: 'm',
      category: 'k',
      payoutAddress: '0x1',
      metadataUri: 'x',
      source: 'seed',
      createdAt: 1,
    })
    .run();
  return h;
}

async function hatch(h: DbHandle) {
  const first = new MockPaymentProvider(getPolicy('default'), () => T0);
  const wallet = await first.createAgent({ userId: 'u1', name: '용이' });
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '용이',
      dragonSpecies: 'forest',
      paymentPath: 'mock',
      status: 'ACTIVE',
      setupStep: 'done',
      walletAddress: wallet.address,
      perOrderLimitAokrw: won(10_000n).toString(),
      createdAt: 1,
    })
    .run();
  return wallet;
}

const fund = (h: DbHandle, n: bigint) =>
  h.db
    .insert(ownerAllowanceEntries)
    .values({ id: 'e1', userId: 'u1', kind: 'fund', amountAokrw: won(n).toString(), createdAt: 1 })
    .run();

const order = (h: DbHandle, n: number, amount: bigint, at: number) =>
  h.db
    .insert(orders)
    .values({
      id: `o${String(n)}`,
      orderRef: REF(n),
      userId: 'u1',
      agentId: 'a1',
      merchantId: 'm1',
      amountAokrw: won(amount).toString(),
      itemsJson: '[]',
      status: 'delivered',
      txHash: REF(1000 + n),
      createdAt: at,
      updatedAt: at,
    })
    .run();

const probe = (agent: Awaited<ReturnType<typeof hatch>>, amount: bigint, ref = 9) => ({
  agent,
  merchantOnchainId: 1n,
  amount,
  orderRef: REF(ref),
});

describe('mock chain after a restart (QA 5)', () => {
  it('boots empty on a database that was never migrated', () => {
    const h = openDb(':memory:');
    handles.push(h);
    expect(new MockChainStateRepository(h).snapshot()).toEqual({ wallets: [], paid: [] });
  });

  it('a fresh provider on the same DB still pays and takes new limits', async () => {
    const h = seed();
    const wallet = await hatch(h);
    fund(h, 20_000n);
    const p = boot(h);
    expect(await p.pay(probe(wallet, won(7_000n), 1))).toMatchObject({ ok: true });
    await p.setTransferLimit(wallet, won(5_000n));
    expect(await p.preflight(probe(wallet, won(7_000n), 2))).toMatchObject({
      ok: false,
      error: { code: 'CHAIN_AGENT_LIMIT' },
    });
  });

  it('keeps the 30-day window, float and paid orders', async () => {
    const h = seed();
    const wallet = await hatch(h);
    fund(h, 30_000n);
    h.db
      .insert(ownerAllowanceEntries)
      .values({
        id: 'e2',
        userId: 'u1',
        kind: 'refund',
        amountAokrw: won(2_000n).toString(),
        createdAt: 2,
      })
      .run();
    order(h, 1, 9_000n, T0 - 1000);
    order(h, 3, 4_000n, T0 - 2000); // second in-window order: the window is a sum
    order(h, 2, 5_000n, 1); // an old window: not counted
    const p = boot(h);
    // 9_000 + 4_000, the 5_000 outside the window is left out
    expect(p.periodicVolume(wallet.address).usedAokrw).toBe(won(13_000n));
    // 30_000 funded - 2_000 refund row - (9_000 + 4_000 + 5_000) spent on all paid orders
    expect(await p.balanceOf(wallet.address)).toBe(won(10_000n));
    expect(await p.findPaid(REF(1))).not.toBeNull();
    expect(await p.findPaid(REF(2))).not.toBeNull();
    expect(await p.findPaid(REF(3))).not.toBeNull();
  });

  it('keeps a frozen agent paused', async () => {
    const h = seed();
    const wallet = await hatch(h);
    fund(h, 20_000n);
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a1')).run();
    expect(await boot(h).preflight(probe(wallet, won(1_000n)))).toMatchObject({
      error: { code: 'CHAIN_AGENT_PAUSED' },
    });
  });

  it('leaves an agent that never finished hatching without a limit', async () => {
    const h = seed();
    const wallet = await hatch(h);
    fund(h, 20_000n);
    h.db
      .update(agents)
      .set({ status: 'PENDING', setupStep: 'limit' })
      .where(eq(agents.id, 'a1'))
      .run();
    expect(await boot(h).preflight(probe(wallet, won(1_000n)))).toMatchObject({
      error: { code: 'CHAIN_AGENT_LIMIT_UNSET' },
    });
  });

  it('never restores from the database when the process is production', () => {
    const snapshot = vi.fn(() => ({ wallets: [], paid: [] }));
    const dev = loadConfig({ PAYMENT_PATH: 'mock' });
    createPaymentProvider({ ...dev, nodeEnv: 'production' }, undefined, snapshot);
    expect(snapshot).not.toHaveBeenCalled();
    createPaymentProvider(dev, undefined, snapshot);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });
});
