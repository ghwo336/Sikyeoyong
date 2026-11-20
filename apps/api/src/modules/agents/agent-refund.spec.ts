import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type OwnerAuthority,
  type PaymentProvider,
  zRefundResult,
  okrwToAokrw,
} from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AllowanceService } from '../allowance/allowance.service.js';
import { AuthService } from '../auth/auth.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentsModule } from './agents.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  const moduleRef = await Test.createTestingModule({ imports: [AgentsModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock', ...env }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  // u1's dragon is hatched (fixture: ACTIVE, level 1); give it a mock wallet.
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const press = (what: 'freeze' | 'drain') =>
    http()
      .post(`/api/agents/me/${what}`)
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch');
  const row = () => h.db.select().from(agents).where(eq(agents.id, 'a-u1')).get();
  const owner = moduleRef.get<OwnerAuthority>(OWNER_AUTHORITY);
  const allowance = moduleRef.get(AllowanceService);
  return { h, http, press, row, payment, owner, token, wallet, allowance };
}

// By hand, through the shared money helper (won to aokrw).
const W = (won: bigint) => okrwToAokrw(won);

describe('POST /api/agents/me/drain (user-flow 17, 돌려받기)', () => {
  it('while frozen: the whole pocket goes back and the owner ledger gets what moved', async () => {
    const { press, payment, wallet, allowance } = await setup();
    await payment.fund(wallet, W(20_000n));
    await press('freeze');
    const res = await press('drain');
    expect(res.status).toBe(200);
    const body = zRefundResult.parse(res.body);
    expect(body.refunded).toBe(W(20_000n).toString());
    expect(body.txHashes).toHaveLength(1);
    expect(await payment.balanceOf(wallet.address)).toBe(0n);
    expect(allowance.balanceAokrw('u1')).toBe(W(20_000n));
  });

  it('an active dragon is refused (409) and nothing moves', async () => {
    const { press, payment, wallet, allowance } = await setup();
    await payment.fund(wallet, W(5_000n));
    const spy = vi.spyOn(payment, 'drain');
    const res = await press('drain');
    expect(res.status).toBe(409);
    expect((res.body as { error: { code: string } }).error.code).toBe('CONFLICT');
    expect(spy).not.toHaveBeenCalled();
    expect(await payment.balanceOf(wallet.address)).toBe(W(5_000n));
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('an empty pocket sends nothing and records nothing', async () => {
    const { press, payment, allowance } = await setup();
    await press('freeze');
    const spy = vi.spyOn(payment, 'drain');
    expect(zRefundResult.parse((await press('drain')).body)).toEqual({
      refunded: '0',
      txHashes: [],
    });
    expect(spy).not.toHaveBeenCalled();
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('two presses together record the refund once', async () => {
    const { press, payment, wallet, allowance } = await setup();
    await payment.fund(wallet, W(20_000n));
    await press('freeze');
    const both = await Promise.all([press('drain'), press('drain')]);
    const amounts = both.map((r) => zRefundResult.parse(r.body).refunded).sort();
    expect(amounts).toEqual(['0', W(20_000n).toString()]);
    expect(allowance.balanceAokrw('u1')).toBe(W(20_000n));
  });

  it('a failed drain records nothing; the owner presses again (no automatic retry)', async () => {
    const { press, payment, wallet, allowance } = await setup();
    await payment.fund(wallet, W(20_000n));
    await press('freeze');
    const spy = vi.spyOn(payment, 'drain').mockRejectedValueOnce(new Error('rpc down'));
    expect((await press('drain')).status).toBe(500);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(allowance.balanceAokrw('u1')).toBe(0n);
    expect(zRefundResult.parse((await press('drain')).body).refunded).toBe(W(20_000n).toString());
    expect(allowance.balanceAokrw('u1')).toBe(W(20_000n));
  });

  it('when the owner must sign (signer user), nothing moves or is recorded', async () => {
    const { press, payment, wallet, owner, allowance } = await setup();
    await payment.fund(wallet, W(20_000n));
    await press('freeze');
    vi.spyOn(owner, 'prepare').mockImplementation((action) =>
      Promise.resolve({ id: 'p1', action, signer: 'user' }),
    );
    expect((await press('drain')).status).toBe(500);
    expect(await payment.balanceOf(wallet.address)).toBe(W(20_000n));
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('needs a session and the fetch header', async () => {
    const { http, token } = await setup();
    expect((await http().post('/api/agents/me/drain')).status).toBe(401);
    expect((await http().post('/api/agents/me/drain').set('Cookie', `sid=${token}`)).status).toBe(
      403,
    );
  });
});
