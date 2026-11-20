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
import { agents, orders } from '../../db/schema/index.js';
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

  it('saved this month is the budget minus what was paid, never below zero', async () => {
    const { h, get } = await setup();
    insertMerchant(h.db, 'm1');
    const paid = (id: string, won: bigint) =>
      h.db
        .insert(orders)
        .values({
          id,
          userId: 'u1',
          agentId: 'a-u1',
          merchantId: 'm1',
          itemsJson: '[]',
          amountAokrw: s(won),
          status: 'paid',
          orderRef: `0x${id.padStart(64, '0')}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        .run();
    const budget = BigInt(zWalletView.parse((await get('u1')).body).savedThisMonth);
    paid('1', 9_000n);
    const after = zWalletView.parse((await get('u1')).body);
    expect(BigInt(after.savedThisMonth)).toBe(budget - W(9_000n));
  });

  it('shows each user only their own ledger', async () => {
    const { allowance, get } = await setup();
    allowance.record('u2', 'trial', W(100_000n), null);
    expect(zWalletView.parse((await get('u1')).body).owner).toBe('0');
    expect(zWalletView.parse((await get('u2')).body).owner).toBe(s(100_000n));
  });
});
