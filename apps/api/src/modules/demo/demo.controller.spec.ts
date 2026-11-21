import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  formatOkrw,
  okrwToAokrw,
  parseAokrw,
  type PaymentProvider,
  zLeakCompareView,
} from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { DemoModule } from './demo.module.js';

// By hand: won * 10^18.
const W = (won: bigint) => okrwToAokrw(won);

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string>) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1', { perOrderWon: 10_000n });
  const moduleRef = await Test.createTestingModule({ imports: [DemoModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock', ...env }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const get = (cookie = `sid=${auth.issue('u1', 'web')}`) =>
    request(app.getHttpServer() as Server)
      .get('/api/demo/leak-compare')
      .set('Cookie', cookie);
  return { h, payment, get, app };
}

describe('GET /api/demo/leak-compare', () => {
  it('is 404 when DEMO_MODE is off, as if the route did not exist', async () => {
    const { get } = await setup({ DEMO_MODE: 'false' });
    expect((await get()).status).toBe(404);
  });

  it('answers 401 without a session even in demo mode', async () => {
    const { app } = await setup({ DEMO_MODE: 'true' });
    const res = await request(app.getHttpServer() as Server).get('/api/demo/leak-compare');
    expect(res.status).toBe(401);
  });

  it('gives per-order, the 30-day cap, float and pocket as aokrw strings (demo profile)', async () => {
    const { get } = await setup({ DEMO_MODE: 'true', POLICY_PROFILE: 'demo' });
    const view = zLeakCompareView.parse((await get()).body);
    // By hand: float = 10,000 * 2 (default multiplier) + 100 (default gas share) = 20,100 won.
    expect(view.perOrderLimit).toBe(W(10_000n).toString());
    expect(view.periodicCap).toBe(W(60_000n).toString());
    expect(view.periodicPeriodSec).toBe(3_600);
    expect(view.floatAtRisk).toBe(W(20_100n).toString());
    expect(view.pocket).toBe('0');
    expect(formatOkrw(parseAokrw(view.floatAtRisk))).toBe('20,100원');
  });

  it('floatAtRisk follows the multiplier and gas share settings, and the pocket is read live', async () => {
    const { h, payment, get } = await setup({
      DEMO_MODE: 'true',
      AGENT_FLOAT_MULTIPLIER: '3',
      AGENT_GAS_SHARE_OKRW: '50',
    });
    const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
    h.db
      .update(agents)
      .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
      .where(eq(agents.id, 'a-u1'))
      .run();
    await payment.fund(wallet, W(20_000n));
    const view = zLeakCompareView.parse((await get()).body);
    expect(view.floatAtRisk).toBe(W(30_050n).toString());
    expect(view.pocket).toBe(W(20_000n).toString());
    expect(view.periodicCap).toBe(W(500_000n).toString());
    expect(view.periodicPeriodSec).toBe(2_592_000);
  });
});
