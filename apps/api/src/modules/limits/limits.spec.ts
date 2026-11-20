import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type OwnerAuthority, type PaymentProvider, zSetLimitsResult } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agentLimitHistory, agents, users } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { LimitsModule } from './limits.module.js';

// Amounts by hand: N won = N * 10^18 aokrw.
const W = (won: string) => `${won}000000000000000000`;

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
  // u1: hatched, per-order 10,000, 30-day 300,000 (default profile range 50,000..500,000 by 50,000).
  insertUser(h.db, 'u1');
  const moduleRef = await Test.createTestingModule({ imports: [LimitsModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock', ...env }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const put = (body: unknown) =>
    http()
      .put('/api/agents/me/limits')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send(body as object);
  const perOrder = () =>
    h.db.select().from(agents).where(eq(agents.id, 'a-u1')).get()?.perOrderLimitAokrw;
  const mine = () =>
    h.db.select().from(users).where(eq(users.id, 'u1')).get()?.myPeriodicLimitAokrw;
  const history = () => h.db.select().from(agentLimitHistory).all();
  const owner = moduleRef.get<OwnerAuthority>(OWNER_AUTHORITY);
  return { h, http, put, perOrder, mine, history, payment, owner, token };
}

const code = (res: { body: unknown }) => (res.body as { error: { code: string } }).error.code;

describe('PUT /api/agents/me/limits (D-31, D-28)', () => {
  it('raises the per-order limit with the button alone in REAUTH_MODE=none: TransferLimit first', async () => {
    const { put, perOrder, mine, history, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await put({ perOrderLimit: W('45000') });
    expect(res.status).toBe(200);
    const body = zSetLimitsResult.parse(res.body);
    expect(body).toMatchObject({ perOrderLimit: W('45000'), myPeriodicLimit: W('300000') });
    expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toBe(BigInt(W('45000')));
    expect(perOrder()).toBe(W('45000'));
    expect(mine()).toBe(W('300000'));
    expect(history().map((r) => [r.transferLimitAokrw, r.txHash])).toEqual([
      [W('45000'), body.txHash],
    ]);
  });

  it('changes only the 30-day limit on the server: no chain write, txHash null', async () => {
    const { put, perOrder, mine, history, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await put({ myPeriodicLimit: W('450000') });
    expect(res.status).toBe(200);
    expect(zSetLimitsResult.parse(res.body)).toEqual({
      perOrderLimit: W('10000'),
      myPeriodicLimit: W('450000'),
      txHash: null,
    });
    expect(write).not.toHaveBeenCalled();
    expect(perOrder()).toBe(W('10000'));
    expect(mine()).toBe(W('450000'));
    expect(history()).toHaveLength(0);
  });

  it('changes both at once: the chain hash is the per-order one', async () => {
    const { put, perOrder, mine } = await setup();
    const body = zSetLimitsResult.parse(
      (await put({ perOrderLimit: W('5000'), myPeriodicLimit: W('100000') })).body,
    );
    expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect([perOrder(), mine()]).toEqual([W('5000'), W('100000')]);
  });

  it.each<[Record<string, string>, string]>([
    [{ perOrderLimit: W('7000') }, 'off step'],
    [{ perOrderLimit: W('55000') }, 'over max'],
    [{ perOrderLimit: W('0') }, 'under min'],
    [{ myPeriodicLimit: W('550000') }, 'over the chain cap'],
    [{ myPeriodicLimit: W('75000') }, 'off step'],
    [{ perOrderLimit: W('20000'), myPeriodicLimit: W('1') }, 'one bad value refuses both'],
  ])('refuses %j (%s) with VALIDATION_FAILED, nothing written', async (body, _why) => {
    const { put, perOrder, mine, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await put(body);
    expect(res.status).toBe(400);
    expect(code(res)).toBe('VALIDATION_FAILED');
    expect(write).not.toHaveBeenCalled();
    expect([perOrder(), mine()]).toEqual([W('10000'), W('300000')]);
  });

  it('refuses a per-order limit above the 30-day limit after the change (D-31), nothing written', async () => {
    // demo profile: 30-day range 10,000..500,000 by 10,000.
    const { put, perOrder, mine, payment } = await setup({ POLICY_PROFILE: 'demo' });
    const both = await put({ perOrderLimit: W('50000'), myPeriodicLimit: W('10000') });
    expect(both.status).toBe(400);
    expect(code(both)).toBe('VALIDATION_FAILED');
    expect([perOrder(), mine()]).toEqual([W('10000'), W('300000')]);
    // Equal is fine.
    expect((await put({ perOrderLimit: W('20000'), myPeriodicLimit: W('20000') })).status).toBe(
      200,
    );
    const write = vi.spyOn(payment, 'setTransferLimit');
    // Either alone is checked against the other's stored value.
    for (const body of [{ perOrderLimit: W('25000') }, { myPeriodicLimit: W('10000') }]) {
      const res = await put(body);
      expect(res.status).toBe(400);
      expect(code(res)).toBe('VALIDATION_FAILED');
    }
    expect(write).not.toHaveBeenCalled();
    expect([perOrder(), mine()]).toEqual([W('20000'), W('20000')]);
  });

  it('in pouch mode a raise of either waits for the owner wallet (Q-30): refused, nothing written', async () => {
    const { put, perOrder, mine, payment } = await setup({ REAUTH_MODE: 'pouch' });
    const write = vi.spyOn(payment, 'setTransferLimit');
    expect((await put({ perOrderLimit: W('20000') })).status).toBe(500);
    expect((await put({ myPeriodicLimit: W('350000') })).status).toBe(500);
    // A lower one with a raise in the same press is refused whole.
    expect((await put({ perOrderLimit: W('5000'), myPeriodicLimit: W('350000') })).status).toBe(
      500,
    );
    expect(write).not.toHaveBeenCalled();
    expect([perOrder(), mine()]).toEqual([W('10000'), W('300000')]);
  });

  it('lowers without re-auth, even in pouch mode', async () => {
    const { put, perOrder, mine, payment } = await setup({ REAUTH_MODE: 'pouch' });
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await put({ perOrderLimit: W('5000'), myPeriodicLimit: W('200000') });
    expect(res.status).toBe(200);
    expect(write.mock.calls[0]?.[1]).toBe(BigInt(W('5000')));
    expect([perOrder(), mine()]).toEqual([W('5000'), W('200000')]);
  });

  it('the same values write nothing', async () => {
    const { put, history, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await put({ perOrderLimit: W('10000'), myPeriodicLimit: W('300000') });
    expect(zSetLimitsResult.parse(res.body).txHash).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(history()).toHaveLength(0);
  });

  it('if the chain write fails, neither limit changes', async () => {
    const { put, perOrder, mine, history, payment } = await setup();
    vi.spyOn(payment, 'setTransferLimit').mockRejectedValueOnce(new Error('rpc down'));
    expect((await put({ perOrderLimit: W('30000'), myPeriodicLimit: W('100000') })).status).toBe(
      500,
    );
    expect([perOrder(), mine()]).toEqual([W('10000'), W('300000')]);
    expect(history()).toHaveLength(0);
  });

  it('when the owner must sign (signer user), the limit does not change before the signature', async () => {
    const { put, perOrder, payment, owner } = await setup();
    vi.spyOn(owner, 'prepare').mockImplementation((action) =>
      Promise.resolve({ id: 'p1', action, signer: 'user' }),
    );
    const write = vi.spyOn(payment, 'setTransferLimit');
    expect((await put({ perOrderLimit: W('20000') })).status).toBe(500);
    expect(write).not.toHaveBeenCalled();
    expect(perOrder()).toBe(W('10000'));
  });

  it.each(['PENDING', 'REVOKED'] as const)(
    'a %s dragon is CHAIN_AGENT_LIMIT_UNSET for a per-order change',
    async (status) => {
      const { h, put, perOrder, payment } = await setup();
      h.db.update(agents).set({ status }).where(eq(agents.id, 'a-u1')).run();
      const write = vi.spyOn(payment, 'setTransferLimit');
      const res = await put({ perOrderLimit: W('20000') });
      expect(code(res)).toBe('CHAIN_AGENT_LIMIT_UNSET');
      expect(write).not.toHaveBeenCalled();
      expect(perOrder()).toBe(W('10000'));
    },
  );

  it('a frozen dragon is SERVER_FROZEN for a per-order change', async () => {
    const { h, put } = await setup();
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a-u1')).run();
    expect(code(await put({ perOrderLimit: W('5000') }))).toBe('SERVER_FROZEN');
  });

  it('needs a body with at least one limit, a session and the fetch header', async () => {
    const { http, put, token } = await setup();
    expect((await put({})).status).toBe(400);
    expect((await put({ perOrderLimit: 20000 })).status).toBe(400);
    expect((await put({ perOrderLimit: W('20000'), level: 3 })).status).toBe(400);
    expect(
      (
        await http()
          .put('/api/agents/me/limits')
          .send({ perOrderLimit: W('20000') })
      ).status,
    ).toBe(401);
    const noHeader = await http()
      .put('/api/agents/me/limits')
      .set('Cookie', `sid=${token}`)
      .send({ perOrderLimit: W('20000') });
    expect(noHeader.status).toBe(403);
  });

  it('the old level endpoint is gone', async () => {
    const { http, token } = await setup();
    const res = await http()
      .post('/api/agents/me/level')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send({ level: 3 });
    expect(res.status).toBe(404);
  });
});
