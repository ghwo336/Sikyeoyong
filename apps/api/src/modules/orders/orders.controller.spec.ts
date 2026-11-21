import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zCreateOrderResult } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { userRateNameOf } from '../../common/rate-limit/user-rate-limit.guard.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, allowedMerchants, approvals, orders, users } from '../../db/schema/index.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { CHAIN_READER, type PeriodicVolume } from '../chain/chain.service.js';
import { orderRefOf } from './order-ref.js';
import { OrdersModule } from './orders.module.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersController } from './orders.controller.js';

// Amounts written by hand: N won = N * 10^18 aokrw. Default policy: Lv1 10,000 per order, 500,000 / 30 days.
const W = (won: string) => `${won}000000000000000000`;
const NOW = Date.parse('2026-12-10T03:00:00.000Z'); // 12:00 KST, December
const errorOf = (body: unknown) => (body as { error: { code: string; dragonLine?: string } }).error;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(
  volume: PeriodicVolume = { usedAokrw: 0n, resetAtSec: null },
  env: Record<string, string> = {},
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1', { dong: '역삼동' });
  insertUser(h.db, 'u2');
  insertMerchant(h.db, 'm1', { name: '마루국밥' });
  insertMerchant(h.db, 'm2', { name: '처음국수' });
  insertMerchant(h.db, 'm-off', { active: false });
  insertMenu(h.db, 'x-dwaeji', 'm1', 9_000n, { name: '돼지국밥' });
  insertMenu(h.db, 'x-sundae', 'm1', 1_000n, { name: '순대 추가' });
  insertMenu(h.db, 'x-out', 'm1', 1_000n, { available: false });
  insertMenu(h.db, 'x-guksu', 'm2', 7_000n, { name: '잔치국수' });
  insertMenu(h.db, 'x-offmenu', 'm-off', 1_000n);
  h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
  const moduleRef = await Test.createTestingModule({ imports: [OrdersModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .overrideProvider(CHAIN_READER)
    .useValue({ periodicVolume: () => Promise.resolve(volume) })
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const http = () => request(app.getHttpServer() as Server);
  const as = (who: 'u1' | 'u2') => ({
    post: (body: object) =>
      http()
        .post('/api/orders')
        .set('Cookie', `sid=${tokens[who]}`)
        .set('X-Requested-With', 'fetch')
        .send(body),
  });
  return { h, http, as, token: tokens.u1, tokens, repo: moduleRef.get(OrdersRepository) };
}

const body = (
  items: { menuId: string; qty: number }[],
  merchantId = 'm1',
  clientOrderId = 'c1',
) => ({
  merchantId,
  items,
  clientOrderId,
});

function paidOrder(
  h: DbHandle,
  id: string,
  merchantId: string,
  won: string,
  createdAt = NOW,
  opts: { userId?: 'u1' | 'u2'; status?: 'paid' | 'quoted' | 'failed' | 'pending_approval' } = {},
) {
  const userId = opts.userId ?? 'u1';
  h.db
    .insert(orders)
    .values({
      id,
      orderRef: `0x${id.padStart(64, '0')}`,
      userId,
      agentId: `a-${userId}`,
      merchantId,
      amountAokrw: W(won),
      itemsJson: '[]',
      status: opts.status ?? 'paid',
      createdAt,
      updatedAt: createdAt,
    })
    .run();
}

describe('POST /api/orders: a quote, never a payment', () => {
  it('prices from the server menus and returns the confirm card with the limits after this order', async () => {
    const { h, as } = await setup({ usedAokrw: BigInt(W('200000')), resetAtSec: null });
    h.db.update(users).set({ addressText: '회사(역삼동)' }).where(eq(users.id, 'u1')).run();
    const res = await as('u1').post(
      body([
        { menuId: 'x-dwaeji', qty: 1 },
        { menuId: 'x-sundae', qty: 1 },
      ]),
    );
    expect(res.status).toBe(200);
    const r = zCreateOrderResult.parse(res.body);
    expect(r.order.status).toBe('quoted');
    expect(r.quote).toEqual({
      orderId: r.order.id,
      store: '마루국밥',
      destination: '회사(역삼동)',
      etaMin: 3, // mock stores: MOCK_ETA_MIN (merchants.md)
      items: [
        { name: '돼지국밥', quantity: 1, price: W('9000') },
        { name: '순대 추가', quantity: 1, price: W('1000') },
      ],
      amount: W('10000'),
      dragonLine: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
      perOrderLimit: W('10000'),
      periodUsedAfter: W('210000'),
      periodCap: W('500000'),
    });
    const row = h.db.select().from(orders).get();
    expect(row).toMatchObject({
      id: r.order.id,
      userId: 'u1',
      agentId: 'a-u1',
      merchantId: 'm1',
      amountAokrw: W('10000'),
      status: 'quoted',
      clientOrderId: 'c1',
      txHash: null,
      submitStartedAt: null,
    });
    expect(row?.orderRef).toBe(orderRefOf(r.order.id)); // keccak of the id (payment.md)
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('uses the neighborhood when there is no address text, else 집', async () => {
    const { h, as } = await setup();
    const a = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body,
    );
    expect(a.quote?.destination).toBe('역삼동');
    h.db.update(users).set({ addressText: '  ' }).where(eq(users.id, 'u1')).run();
    const blank = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }], 'm1', 'c3'))).body,
    );
    expect(blank.quote?.destination).toBe('역삼동'); // blank text is not an address
    h.db.update(users).set({ addressDong: null }).where(eq(users.id, 'u1')).run();
    const b = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }], 'm1', 'c2'))).body,
    );
    expect(b.quote?.destination).toBe('집');
  });

  it('takes no price from the client (strict body)', async () => {
    const { h, as } = await setup();
    const res = await as('u1').post({ ...body([{ menuId: 'x-dwaeji', qty: 1 }]), amount: '1' });
    expect(res.status).toBe(400);
    const priced = await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1, price: '1' } as never]));
    expect(priced.status).toBe(400);
    expect(h.db.select().from(orders).all()).toHaveLength(0);
  });

  it('needs a session (401) and the fetch header for a cookie write (403)', async () => {
    const { h, http, token } = await setup();
    const tokenless = await http()
      .post('/api/orders')
      .set('Cookie', 'sid=nope')
      .set('X-Requested-With', 'fetch')
      .send(body([{ menuId: 'x-dwaeji', qty: 1 }]));
    expect(tokenless.status).toBe(401);
    const noHeader = await http()
      .post('/api/orders')
      .set('Cookie', `sid=${token}`)
      .send(body([{ menuId: 'x-dwaeji', qty: 1 }]));
    expect(noHeader.status).toBe(403);
    expect(h.db.select().from(orders).all()).toHaveLength(0);
    expect(
      (
        await http()
          .post('/api/orders')
          .send(body([{ menuId: 'x-dwaeji', qty: 1 }]))
      ).status,
    ).toBe(401);
  });
});

describe('POST /api/orders: rules that ask the owner (pending_approval with its approval row)', () => {
  it('over the level per-order limit: one won over is OVER_LEVEL_LIMIT, exactly the limit is quoted', async () => {
    const { h, as } = await setup();
    const at = await as('u1').post(
      body([
        { menuId: 'x-dwaeji', qty: 1 },
        { menuId: 'x-sundae', qty: 1 },
      ]),
    );
    expect(zCreateOrderResult.parse(at.body).order.status).toBe('quoted');
    const over = await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 2 }], 'm1', 'c2'));
    const r = zCreateOrderResult.parse(over.body);
    expect(r).toEqual({ order: { id: r.order.id, status: 'pending_approval' } });
    const ap = h.db.select().from(approvals).all();
    expect(ap).toHaveLength(1);
    expect(ap[0]).toMatchObject({
      orderId: r.order.id,
      userId: 'u1',
      agentId: 'a-u1',
      reason: 'OVER_LEVEL_LIMIT',
      status: 'pending',
      expiresAt: NOW + 600_000,
    });
    expect(JSON.parse(ap[0]?.payloadJson ?? '{}')).toEqual({
      merchantId: 'm1',
      amount: W('18000'),
    });
  });

  it('a store never allowed and never paid at is NEW_MERCHANT; a paid order there makes it known', async () => {
    const { h, as } = await setup();
    const first = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2', 'c1'))).body,
    );
    expect(first.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
    paidOrder(h, 'p1', 'm2', '7000');
    const again = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2', 'c2'))).body,
    );
    expect(again.order.status).toBe('quoted');
  });

  it('orders not paid yet (quoted, failed, waiting) do not make a store known', async () => {
    const { h, as } = await setup();
    paidOrder(h, 'q1', 'm2', '7000', NOW, { status: 'quoted' });
    paidOrder(h, 'f1', 'm2', '7000', NOW, { status: 'failed' });
    const first = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2', 'c1'))).body,
    );
    expect(first.order.status).toBe('pending_approval');
    // Resending under a new clientOrderId must not slip past the owner.
    const again = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2', 'c2'))).body,
    );
    expect(again.order.status).toBe('pending_approval');
    const reasons = h.db
      .select()
      .from(approvals)
      .all()
      .map((a) => a.reason);
    expect(reasons).toEqual(['NEW_MERCHANT', 'NEW_MERCHANT']);
  });

  it('another user having paid at a store does not make it known to this one', async () => {
    const { h, as } = await setup();
    paidOrder(h, 'p2', 'm2', '7000', NOW, { userId: 'u2' });
    const r = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2'))).body,
    );
    expect(r.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
  });

  it('in demo mode a seeded store counts as allowed (D-27): the first order is a plain quote', async () => {
    const { h, as } = await setup(undefined, { DEMO_MODE: 'true' });
    const r = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2'))).body,
    );
    expect(r.order.status).toBe('quoted');
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('in demo mode a store that is not seeded still asks the owner (D-27 is seed stores only)', async () => {
    const { h, as } = await setup(undefined, { DEMO_MODE: 'true' });
    insertMerchant(h.db, 'm-console', { name: '등록가게', source: 'console' });
    insertMenu(h.db, 'x-console', 'm-console', 7_000n);
    const r = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-console', qty: 1 }], 'm-console'))).body,
    );
    expect(r.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
  });

  it('outside demo mode the same seeded store is still new (D-07 unchanged)', async () => {
    const { h, as } = await setup(undefined, {});
    const r = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2'))).body,
    );
    expect(r.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
  });

  it('a store allowed for another user is still new for this one', async () => {
    const { h, as } = await setup();
    const r = zCreateOrderResult.parse(
      (await as('u2').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body,
    );
    expect(r.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
  });

  it('over the owner 30-day limit in the chain window is OVER_PERSONAL_BUDGET; landing exactly on it is quoted (D-31)', async () => {
    // The chain says 291,000 used in its 30-day window; the owner's limit is 300,000.
    const { h, as } = await setup({ usedAokrw: BigInt(W('291000')), resetAtSec: null });
    // Orders in the DB this calendar month do not count: only the chain window does.
    paidOrder(h, 'p1', 'm1', '200000');
    const exact = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body,
    );
    expect(exact.order.status).toBe('quoted'); // 291,000 + 9,000 = 300,000
    const over = zCreateOrderResult.parse(
      (
        await as('u1').post(
          body(
            [
              { menuId: 'x-dwaeji', qty: 1 },
              { menuId: 'x-sundae', qty: 1 },
            ],
            'm1',
            'c2',
          ),
        )
      ).body,
    );
    expect(over.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_PERSONAL_BUDGET');
  });

  it('does not check the owner limit when it equals the chain cap: the chain keeps it (D-31, scene 14)', async () => {
    const { h, as } = await setup({ usedAokrw: BigInt(W('491000')), resetAtSec: null });
    h.db
      .update(users)
      .set({ myPeriodicLimitAokrw: W('500000') })
      .where(eq(users.id, 'u1'))
      .run();
    // 491,000 + 9,000 is over nothing the server keeps: quoted, no approval asked.
    const res = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body,
    );
    expect(res.order.status).toBe('quoted');
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('the per-order rule wins when several apply', async () => {
    const { h, as } = await setup();
    await as('u1').post(body([{ menuId: 'x-guksu', qty: 2 }], 'm2')); // 14,000 at a new store
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_LEVEL_LIMIT');
  });
});

describe('POST /api/orders: refusals that make no order', () => {
  it('past the chain 30-day cap: CHAIN_PERIODIC_LIMIT with when it opens, nothing written', async () => {
    const { h, as } = await setup({
      usedAokrw: BigInt(W('495000')),
      resetAtSec: Date.parse('2026-12-20T09:30:00.000Z') / 1000,
    });
    // The owner's limit is the chain cap, so only the chain's refusal shows (D-31).
    h.db
      .update(users)
      .set({ myPeriodicLimitAokrw: W('500000') })
      .where(eq(users.id, 'u1'))
      .run();
    const res = await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]));
    expect(res.status).toBe(422);
    expect(errorOf(res.body)).toMatchObject({
      code: 'CHAIN_PERIODIC_LIMIT',
      dragonLine: '이번 30일 배달비를 다 썼어용. 12월 20일 오후 6시 30분부터 다시 시킬 수 있어용',
    });
    expect(h.db.select().from(orders).all()).toHaveLength(0);
    const exact = await as('u1').post(body([{ menuId: 'x-sundae', qty: 5 }], 'm1', 'c2'));
    expect(zCreateOrderResult.parse(exact.body).order.status).toBe('quoted'); // 495,000 + 5,000 = 500,000
  });

  it('a frozen dragon is SERVER_FROZEN; a dragon still hatching is CHAIN_AGENT_LIMIT_UNSET', async () => {
    const { h, as } = await setup();
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a-u1')).run();
    expect(errorOf((await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body).code).toBe(
      'SERVER_FROZEN',
    );
    h.db.update(agents).set({ status: 'PENDING' }).where(eq(agents.id, 'a-u1')).run();
    expect(errorOf((await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]))).body).code).toBe(
      'CHAIN_AGENT_LIMIT_UNSET',
    );
    expect(h.db.select().from(orders).all()).toHaveLength(0);
  });

  it.each([
    ['an unknown store', body([{ menuId: 'x-dwaeji', qty: 1 }], 'nope'), 'NOT_FOUND'],
    [
      'an inactive store',
      body([{ menuId: 'x-offmenu', qty: 1 }], 'm-off'),
      'CHAIN_MERCHANT_INACTIVE',
    ],
    ['a sold-out menu', body([{ menuId: 'x-out', qty: 1 }]), 'NOT_FOUND'],
    ['a menu of another store', body([{ menuId: 'x-guksu', qty: 1 }]), 'NOT_FOUND'],
    [
      'the same menu twice',
      body([
        { menuId: 'x-dwaeji', qty: 1 },
        { menuId: 'x-dwaeji', qty: 1 },
      ]),
      'VALIDATION_FAILED',
    ],
  ])('%s is %s', async (_name, b, code) => {
    const { h, as } = await setup();
    expect(errorOf((await as('u1').post(b)).body).code).toBe(code);
    expect(h.db.select().from(orders).all()).toHaveLength(0);
  });
});

describe('POST /api/orders: clientOrderId', () => {
  it('a resend of the same order gets the same order, written once', async () => {
    const { h, as } = await setup();
    const b = body([
      { menuId: 'x-dwaeji', qty: 1 },
      { menuId: 'x-sundae', qty: 1 },
    ]);
    const a = zCreateOrderResult.parse((await as('u1').post(b)).body);
    const again = zCreateOrderResult.parse(
      (await as('u1').post({ ...b, items: [...b.items].reverse() })).body,
    );
    expect(again).toEqual(a);
    expect(h.db.select().from(orders).all()).toHaveLength(1);
  });

  it('a resend answers the first result even if the rules changed since (frozen meanwhile)', async () => {
    const { h, as } = await setup();
    const b = body([{ menuId: 'x-dwaeji', qty: 1 }]);
    const a = zCreateOrderResult.parse((await as('u1').post(b)).body);
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a-u1')).run();
    const again = await as('u1').post(b);
    expect(again.status).toBe(200);
    expect(zCreateOrderResult.parse(again.body).order).toEqual(a.order);
  });

  it('a resend of a pending order answers its status without a quote or a second approval', async () => {
    const { h, as } = await setup();
    const b = body([{ menuId: 'x-dwaeji', qty: 2 }]);
    const a = zCreateOrderResult.parse((await as('u1').post(b)).body);
    expect(zCreateOrderResult.parse((await as('u1').post(b)).body)).toEqual(a);
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
  });

  it('the same clientOrderId for another order is 409; another user may use it', async () => {
    const { h, as } = await setup();
    await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }]));
    const clash = await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 2 }]));
    expect(clash.status).toBe(409);
    expect(errorOf(clash.body).code).toBe('CONFLICT');
    h.db.insert(allowedMerchants).values({ userId: 'u2', merchantId: 'm1', approvedAt: 1 }).run();
    const other = await as('u2').post(body([{ menuId: 'x-dwaeji', qty: 1 }]));
    expect(zCreateOrderResult.parse(other.body).order.status).toBe('quoted');
    expect(h.db.select().from(orders).all()).toHaveLength(2);
  });

  // Two requests with one clientOrderId at once: both pass the first lookup, the
  // unique index lets one write, and the loser answers like the winner.
  it('the loser of a race on one clientOrderId gets the same quoted order, written once', async () => {
    const { h, as, repo } = await setup();
    const b = body([{ menuId: 'x-dwaeji', qty: 1 }]);
    const first = zCreateOrderResult.parse((await as('u1').post(b)).body);
    const spy = vi.spyOn(repo, 'findByClientOrderId').mockReturnValueOnce(undefined);
    const lost = await as('u1').post(b);
    expect(lost.status).toBe(200);
    expect(zCreateOrderResult.parse(lost.body)).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(2); // the first lookup missed, the replay found it
    spy.mockReturnValueOnce(undefined);
    const clash = await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 2 }]));
    expect(clash.status).toBe(409);
    expect(h.db.select().from(orders).all()).toHaveLength(1);
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('the loser of a race on a pending order gets it too, with one approval row', async () => {
    const { h, as, repo } = await setup();
    const b = body([{ menuId: 'x-dwaeji', qty: 2 }]);
    const first = zCreateOrderResult.parse((await as('u1').post(b)).body);
    vi.spyOn(repo, 'findByClientOrderId').mockReturnValueOnce(undefined);
    const lost = zCreateOrderResult.parse((await as('u1').post(b)).body);
    expect(lost).toEqual(first);
    expect(h.db.select().from(orders).all()).toHaveLength(1);
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
  });
});

describe('POST /api/orders/:id/requote: the waiting order after a per-order raise (user-flow 12)', () => {
  async function overOrder() {
    const s = await setup();
    const over = await s.as('u1').post(body([{ menuId: 'x-dwaeji', qty: 2 }], 'm1', 'c-over'));
    const id = zCreateOrderResult.parse(over.body).order.id;
    const requote = (who: 'u1' | 'u2' = 'u1') =>
      s
        .http()
        .post(`/api/orders/${id}/requote`)
        .set('Cookie', `sid=${s.tokens[who]}`)
        .set('X-Requested-With', 'fetch');
    return { ...s, id, requote };
  }
  const raiseTo = (h: DbHandle, won: string) =>
    h.db
      .update(agents)
      .set({ perOrderLimitAokrw: W(won) })
      .where(eq(agents.id, 'a-u1'))
      .run();

  it('still over the limit: stays pending_approval, no quote, the approval still waits', async () => {
    const { h, id, requote } = await overOrder();
    const res = await requote();
    expect(res.status).toBe(200);
    expect(zCreateOrderResult.parse(res.body)).toEqual({
      order: { id, status: 'pending_approval' },
    });
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
  });

  it('after the raise: quoted with its confirm card, the approval closed as approved, nothing paid', async () => {
    const { h, id, requote } = await overOrder();
    raiseTo(h, '20000');
    const res = await requote();
    const r = zCreateOrderResult.parse(res.body);
    expect(r.order).toEqual({ id, status: 'quoted' });
    expect(r.quote).toMatchObject({ orderId: id, amount: W('18000'), perOrderLimit: W('20000') });
    expect(h.db.select().from(approvals).get()?.status).toBe('approved');
    expect(h.db.select().from(orders).where(eq(orders.id, id)).get()?.status).toBe('quoted');
    // A second call answers the same card (no new approval, no payment).
    const again = zCreateOrderResult.parse((await requote()).body);
    expect(again.order.status).toBe('quoted');
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
  });

  it('exactly the new limit is enough: quoted', async () => {
    const { h, id, requote } = await overOrder();
    raiseTo(h, '18000');
    expect(zCreateOrderResult.parse((await requote()).body).order).toEqual({
      id,
      status: 'quoted',
    });
  });

  it('a wait for a new store stays pending_approval with its approval pending, even within the limit', async () => {
    const { h, as, tokens, http } = await setup();
    const res = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-guksu', qty: 1 }], 'm2', 'c-new'))).body,
    );
    expect(res.order.status).toBe('pending_approval');
    raiseTo(h, '50000');
    const again = await http()
      .post(`/api/orders/${res.order.id}/requote`)
      .set('Cookie', `sid=${tokens.u1}`)
      .set('X-Requested-With', 'fetch');
    expect(zCreateOrderResult.parse(again.body)).toEqual({
      order: { id: res.order.id, status: 'pending_approval' },
    });
    expect(h.db.select().from(approvals).get()).toMatchObject({
      reason: 'NEW_MERCHANT',
      status: 'pending',
    });
  });

  it('a wait for the 30-day limit stays pending_approval with its approval pending', async () => {
    const { h, as, tokens, http } = await setup({
      usedAokrw: BigInt(W('295000')),
      resetAtSec: null,
    });
    const res = zCreateOrderResult.parse(
      (await as('u1').post(body([{ menuId: 'x-dwaeji', qty: 1 }], 'm1', 'c-month'))).body,
    );
    expect(res.order.status).toBe('pending_approval');
    const again = await http()
      .post(`/api/orders/${res.order.id}/requote`)
      .set('Cookie', `sid=${tokens.u1}`)
      .set('X-Requested-With', 'fetch');
    expect(zCreateOrderResult.parse(again.body).order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()).toMatchObject({
      reason: 'OVER_PERSONAL_BUDGET',
      status: 'pending',
    });
  });

  it('an expired approval is not reopened', async () => {
    const { h, id, requote } = await overOrder();
    raiseTo(h, '20000');
    vi.setSystemTime(NOW + 600_000);
    const r = zCreateOrderResult.parse((await requote()).body);
    expect(r.order.status).toBe('pending_approval');
    expect(h.db.select().from(orders).where(eq(orders.id, id)).get()?.status).toBe(
      'pending_approval',
    );
  });

  it("another user's order is 404, a signed out call is 401", async () => {
    const { http, id, requote } = await overOrder();
    expect((await requote('u2')).status).toBe(404);
    const signedOut = await http()
      .post(`/api/orders/${id}/requote`)
      .set('X-Requested-With', 'fetch');
    expect(signedOut.status).toBe(401);
  });
});

describe('write routes carry their rate limit (tech-spec 9.5)', () => {
  it.each([
    ['create', 'order'],
    ['confirm', 'orderStep'],
    ['requote', 'orderStep'],
    ['rate', 'rating'],
  ])('OrdersController.%s is %s', (method, name) => {
    const handler = (OrdersController.prototype as unknown as Record<string, () => unknown>)[
      method
    ];
    expect(handler === undefined ? undefined : userRateNameOf(handler)).toBe(name);
  });
});
