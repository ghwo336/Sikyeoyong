import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type OwnerAuthority, type PaymentProvider, zFreezeResult } from '@sikyeoyong/shared';
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
  // u1's dragon is hatched (fixture: ACTIVE, 10,000 per order); give it a mock wallet.
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const press = (what: 'freeze' | 'unfreeze') =>
    http()
      .post(`/api/agents/me/${what}`)
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch');
  const row = () => h.db.select().from(agents).where(eq(agents.id, 'a-u1')).get();
  const owner = moduleRef.get<OwnerAuthority>(OWNER_AUTHORITY);
  return { h, http, press, row, payment, owner, token, wallet };
}

describe('POST /api/agents/me/freeze and /unfreeze (user-flow 17)', () => {
  it('freeze: the server flag and the chain pause; a leaked key cannot place an order through the contract (float sent outside the order path is not covered, D-06)', async () => {
    const { press, row, payment, wallet } = await setup();
    const res = await press('freeze');
    expect(res.status).toBe(200);
    const body = zFreezeResult.parse(res.body);
    expect(body.frozen).toBe(true);
    expect(body.txHashes).toHaveLength(1);
    expect(row()?.status).toBe('FROZEN');
    // The mock chain refuses a payment from a paused agent (tech-spec 9.3 key-leak scene).
    // Money and a limit, so pause is the only reason left to refuse.
    await payment.setTransferLimit(wallet, 10n ** 22n);
    await payment.fund(wallet, 10n ** 22n);
    const paid = await payment.pay({
      agent: { agentRowId: 'a-u1', address: wallet.address, ownerAddress: wallet.ownerAddress },
      merchantOnchainId: 1n,
      amount: 1n,
      orderRef: `0x${'1'.repeat(64)}`,
    });
    expect(paid).toMatchObject({ ok: false, error: { code: 'CHAIN_AGENT_PAUSED' } });
  });

  it('freeze flips the server flag before the chain: a failed chain call leaves it frozen', async () => {
    const { press, row, payment } = await setup();
    vi.spyOn(payment, 'freeze').mockRejectedValueOnce(new Error('rpc down'));
    expect((await press('freeze')).status).toBe(500);
    expect(row()?.status).toBe('FROZEN');
    // The owner presses again; the chain pause is sent this time.
    const again = zFreezeResult.parse((await press('freeze')).body);
    expect(again.txHashes).toHaveLength(1);
  });

  it('unfreeze resumes the chain first: a failed chain call keeps the dragon frozen', async () => {
    const { press, row, payment } = await setup();
    await press('freeze');
    vi.spyOn(payment, 'unfreeze').mockRejectedValueOnce(new Error('rpc down'));
    expect((await press('unfreeze')).status).toBe(500);
    expect(row()?.status).toBe('FROZEN');
    const ok = zFreezeResult.parse((await press('unfreeze')).body);
    expect(ok).toMatchObject({ frozen: false });
    expect(ok.txHashes).toHaveLength(1);
    expect(row()?.status).toBe('ACTIVE');
  });

  it('a freeze pressed while a slow unfreeze is running wins: frozen on server and chain', async () => {
    const { press, row, payment, wallet } = await setup();
    await press('freeze');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const realUnfreeze = payment.unfreeze.bind(payment);
    vi.spyOn(payment, 'unfreeze').mockImplementationOnce(async (a) => {
      await gate; // the chain unpause takes a while
      return realUnfreeze(a);
    });
    // supertest sends on then(): start each request now, in this order.
    const waking = press('unfreeze').then((r) => r);
    await new Promise((r) => setTimeout(r, 20));
    const freezing = press('freeze').then((r) => r);
    await new Promise((r) => setTimeout(r, 20));
    release();
    const [woke, froze] = await Promise.all([waking, freezing]);
    expect(zFreezeResult.parse(woke.body).frozen).toBe(false);
    expect(zFreezeResult.parse(froze.body).frozen).toBe(true);
    // The last press was freeze, so the dragon ends frozen everywhere.
    expect(row()?.status).toBe('FROZEN');
    await payment.setTransferLimit(wallet, 10n ** 22n);
    await payment.fund(wallet, 10n ** 22n);
    const paid = await payment.pay({
      agent: { agentRowId: 'a-u1', address: wallet.address, ownerAddress: wallet.ownerAddress },
      merchantOnchainId: 1n,
      amount: 1n,
      orderRef: `0x${'2'.repeat(64)}`,
    });
    expect(paid).toMatchObject({ ok: false, error: { code: 'CHAIN_AGENT_PAUSED' } });
  });

  it('unfreeze on an active dragon sends nothing', async () => {
    const { press, payment } = await setup();
    const spy = vi.spyOn(payment, 'unfreeze');
    expect(zFreezeResult.parse((await press('unfreeze')).body)).toEqual({
      frozen: false,
      txHashes: [],
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'REVOKED'] as const)(
    'a %s dragon cannot be frozen or woken',
    async (status) => {
      const { h, press, payment } = await setup();
      h.db.update(agents).set({ status }).where(eq(agents.id, 'a-u1')).run();
      const spy = vi.spyOn(payment, 'freeze');
      const res = await press('freeze');
      expect((res.body as { error: { code: string } }).error.code).toBe('CHAIN_AGENT_LIMIT_UNSET');
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('when the owner must sign (signer user), freeze stops the server but sends no chain call', async () => {
    const { press, row, payment, owner } = await setup();
    vi.spyOn(owner, 'prepare').mockImplementation((action) =>
      Promise.resolve({ id: 'p1', action, signer: 'user' }),
    );
    const spy = vi.spyOn(payment, 'freeze');
    expect((await press('freeze')).status).toBe(500);
    expect(spy).not.toHaveBeenCalled();
    expect(row()?.status).toBe('FROZEN');
  });

  it('needs a session and the fetch header', async () => {
    const { http, token } = await setup();
    expect((await http().post('/api/agents/me/freeze')).status).toBe(401);
    expect((await http().post('/api/agents/me/freeze').set('Cookie', `sid=${token}`)).status).toBe(
      403,
    );
  });
});
