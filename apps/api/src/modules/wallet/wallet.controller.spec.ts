import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, type PaymentProvider, zWalletView } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, orders, users } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { AllowanceService } from '../allowance/allowance.service.js';
import { AuthService } from '../auth/auth.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { WalletModule } from './wallet.module.js';

// By hand: won * 10^18.
const W = (won: bigint) => okrwToAokrw(won);
const s = (won: bigint) => W(won).toString();

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  insertUser(h.db, 'u2');
  const moduleRef = await Test.createTestingModule({ imports: [WalletModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const allowance = moduleRef.get(AllowanceService);
  const get = (user: string) =>
    request(app.getHttpServer() as Server)
      .get('/api/wallet')
      .set('Cookie', `sid=${auth.issue(user, 'web')}`);
  return { h, app, payment, allowance, get };
}

describe('GET /api/wallet', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect((await request(app.getHttpServer() as Server).get('/api/wallet')).status).toBe(401);
  });

  it('owner is trial + refund - fund from the ledger; pocket is the dragon wallet on chain', async () => {
    const { h, payment, allowance, get } = await setup();
    const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
    h.db
      .update(agents)
      .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
      .where(eq(agents.id, 'a-u1'))
      .run();
    allowance.record('u1', 'trial', W(100_000n), null);
    allowance.record('u1', 'fund', W(20_000n), null);
    allowance.record('u1', 'refund', W(1_000n), null);
    await payment.fund(wallet, W(20_000n));
    const view = zWalletView.parse((await get('u1')).body);
    expect(view.owner).toBe(s(81_000n));
    expect(view.pocket).toBe(s(20_000n));
  });

  it('a dragon without a wallet yet has an empty pocket', async () => {
    const { get } = await setup();
    const view = zWalletView.parse((await get('u1')).body);
    expect(view.pocket).toBe('0');
    expect(view.owner).toBe('0');
  });

  it('saved this month is the 30-day limit minus what was paid, 0 with no paid order, and 0 when spent reaches or passes it', async () => {
    const { h, get } = await setup();
    // u1's 30-day limit is 50,000 won, the range's lowest (the fixture default is 300,000).
    h.db
      .update(users)
      .set({ myPeriodicLimitAokrw: s(50_000n) })
      .where(eq(users.id, 'u1'))
      .run();
    insertMerchant(h.db, 'm1');
    let seq = 0;
    const paid = (won: bigint) => {
      seq += 1;
      h.db
        .insert(orders)
        .values({
          id: `o${seq}`,
          userId: 'u1',
          agentId: 'a-u1',
          merchantId: 'm1',
          itemsJson: '[]',
          amountAokrw: s(won),
          status: 'paid',
          orderRef: `0x${String(seq).padStart(64, '0')}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();
    };
    const saved = async () => zWalletView.parse((await get('u1')).body).savedThisMonth;
    // No paid order yet: nothing saved, not the whole limit.
    expect(await saved()).toBe('0');
    paid(49_000n);
    expect(await saved()).toBe(s(1_000n));
    paid(1_000n); // exactly the limit
    expect(await saved()).toBe('0');
    paid(5_000n); // past the budget: 200 and 0, not an error
    const res = await get('u1');
    expect(res.status).toBe(200);
    expect(zWalletView.parse(res.body).savedThisMonth).toBe('0');
  });

  it('owner shows 0 (and 200) when more went out than came in', async () => {
    const { allowance, get } = await setup();
    allowance.record('u1', 'fund', W(5_000n), null);
    const res = await get('u1');
    expect(res.status).toBe(200);
    expect(zWalletView.parse(res.body).owner).toBe('0');
    allowance.record('u1', 'trial', W(3_000n), null);
    expect(zWalletView.parse((await get('u1')).body).owner).toBe('0');
    allowance.record('u1', 'refund', W(4_000n), null);
    expect(zWalletView.parse((await get('u1')).body).owner).toBe(s(2_000n));
  });

  it('the ledger refuses a zero or negative amount', async () => {
    const { allowance } = await setup();
    expect(() => allowance.record('u1', 'fund', 0n, null)).toThrow(RangeError);
    expect(() => allowance.record('u1', 'refund', -1n, null)).toThrow(RangeError);
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('shows each user only their own ledger', async () => {
    const { allowance, get } = await setup();
    allowance.record('u2', 'trial', W(100_000n), null);
    expect(zWalletView.parse((await get('u1')).body).owner).toBe('0');
    expect(zWalletView.parse((await get('u2')).body).owner).toBe(s(100_000n));
  });
});
