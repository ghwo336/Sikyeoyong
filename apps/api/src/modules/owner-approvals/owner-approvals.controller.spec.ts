import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type PaymentProvider,
  zApprovalDecision,
  zApprovalList,
  zCreateOrderResult,
  zOrderResult,
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
import { agents, allowedMerchants, approvals, orders } from '../../db/schema/index.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CHAIN_READER } from '../chain/chain.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { OwnerApprovalsModule } from './owner-approvals.module.js';

// Amounts by hand: N won = N * 10^18 aokrw. Default policy: level 1, 10,000 per order; budget 300,000.
const W = (won: string) => `${won}000000000000000000`;
const NOW = Date.parse('2026-12-10T03:00:00.000Z');
const errorOf = (body: unknown) => (body as { error: { code: string } }).error;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1', { dong: '역삼동' });
  insertUser(h.db, 'u2');
  insertMerchant(h.db, 'm1', { name: '마루국밥' });
  insertMerchant(h.db, 'm2', { name: '처음국수' });
  insertMenu(h.db, 'x-dwaeji', 'm1', 9_000n, { name: '돼지국밥' });
  insertMenu(h.db, 'x-guksu', 'm2', 7_000n, { name: '잔치국수' });
  h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
  const moduleRef = await Test.createTestingModule({ imports: [OwnerApprovalsModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
    )
    .overrideProvider(CHAIN_READER)
    .useValue({ periodicVolume: () => Promise.resolve({ usedAokrw: 0n, resetAtSec: null }) })
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
  await payment.setTransferLimit(wallet, BigInt(W('10000')));
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const http = () => request(app.getHttpServer() as Server);
  const post = (who: 'u1' | 'u2', path: string, body: object = {}) =>
    http()
      .post(path)
      .set('Cookie', `sid=${tokens[who]}`)
      .set('X-Requested-With', 'fetch')
      .send(body);
  const get = (who: 'u1' | 'u2', path: string) =>
    http().get(path).set('Cookie', `sid=${tokens[who]}`);
  /** A pending order and its approval id. */
  const pending = async (merchantId: string, menuId: string, qty = 1, clientOrderId = 'c1') => {
    const r = zCreateOrderResult.parse(
      (await post('u1', '/api/orders', { merchantId, items: [{ menuId, qty }], clientOrderId }))
        .body,
    );
    const ap = h.db.select().from(approvals).where(eq(approvals.orderId, r.order.id)).get();
    return { orderId: r.order.id, approvalId: ap?.id ?? 'none' };
  };
  const order = (id: string) => h.db.select().from(orders).where(eq(orders.id, id)).get();
  return {
    h,
    http,
    post,
    get,
    pending,
    order,
    payment,
    approvalsService: moduleRef.get(ApprovalsService),
  };
}

describe('GET /api/approvals', () => {
  it('lists the session user pending approvals with store and aokrw amount', async () => {
    const { get, pending } = await setup();
    const p = await pending('m2', 'x-guksu');
    const res = await get('u1', '/api/approvals?status=pending');
    expect(res.status).toBe(200);
    expect(zApprovalList.parse(res.body)).toEqual({
      approvals: [
        {
          id: p.approvalId,
          orderId: p.orderId,
          reason: 'NEW_MERCHANT',
          store: '처음국수',
          amount: W('7000'),
          expiresAt: NOW + 600_000,
        },
      ],
    });
    expect(zApprovalList.parse((await get('u2', '/api/approvals')).body).approvals).toEqual([]);
    expect((await get('u1', '/api/approvals?status=approved')).status).toBe(400);
  });

  it('expires approvals past 10 minutes: gone from the list, their order failed for good', async () => {
    const { get, pending, order } = await setup();
    const p = await pending('m2', 'x-guksu');
    vi.setSystemTime(NOW + 600_000);
    expect(zApprovalList.parse((await get('u1', '/api/approvals')).body).approvals).toEqual([]);
    expect(order(p.orderId)).toMatchObject({ status: 'failed', errorCode: 'SERVER_NEW_MERCHANT' });
  });
});

describe('POST /api/approvals/:id/approve: never pays, quotes again', () => {
  it('a new store: remembered, the order quoted again with its card; the card button then pays', async () => {
    const { h, post, pending, order, payment } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const p = await pending('m2', 'x-guksu');
    const res = await post('u1', `/api/approvals/${p.approvalId}/approve`);
    expect(res.status).toBe(200);
    const d = zApprovalDecision.parse(res.body);
    expect(d.approval).toEqual({ id: p.approvalId, status: 'approved' });
    expect(d.order).toEqual({ id: p.orderId, status: 'quoted' });
    expect(d.quote).toMatchObject({ orderId: p.orderId, store: '처음국수', amount: W('7000') });
    expect(pay).not.toHaveBeenCalled();
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(1);
    const paid = zOrderResult.parse((await post('u1', `/api/orders/${p.orderId}/confirm`)).body);
    expect(paid.order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(order(p.orderId)?.status).toBe('paid');
  });

  it('a budget overrun: allowed for this order amount, so the press pays without asking again', async () => {
    const { h, post, pending } = await setup();
    // m2 is known by a paid order, not by an allowance: approving the budget must not allow it.
    h.db
      .insert(orders)
      .values({
        id: 'p0',
        orderRef: `0x${'1'.repeat(64)}`,
        userId: 'u1',
        agentId: 'a-u1',
        merchantId: 'm2',
        amountAokrw: W('295000'),
        itemsJson: '[]',
        status: 'paid',
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();
    const p = await pending('m2', 'x-guksu'); // 295,000 + 7,000 > 300,000
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_PERSONAL_BUDGET');
    const d = zApprovalDecision.parse(
      (await post('u1', `/api/approvals/${p.approvalId}/approve`)).body,
    );
    expect(d.order.status).toBe('quoted');
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(0);
    const paid = zOrderResult.parse((await post('u1', `/api/orders/${p.orderId}/confirm`)).body);
    expect(paid.order.status).toBe('paid');
  });

  it('a level overrun is raised with POST /agents/me/level, not here: 400 and nothing changes', async () => {
    const { h, post, pending, order } = await setup();
    const p = await pending('m1', 'x-dwaeji', 2); // 18,000 over level 1
    const res = await post('u1', `/api/approvals/${p.approvalId}/approve`);
    expect(res.status).toBe(400);
    expect(errorOf(res.body).code).toBe('VALIDATION_FAILED');
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(order(p.orderId)?.status).toBe('pending_approval');
  });

  it('approving twice answers the same and remembers the store once', async () => {
    const { h, post, pending } = await setup();
    const p = await pending('m2', 'x-guksu');
    const a = zApprovalDecision.parse(
      (await post('u1', `/api/approvals/${p.approvalId}/approve`)).body,
    );
    const b = zApprovalDecision.parse(
      (await post('u1', `/api/approvals/${p.approvalId}/approve`)).body,
    );
    expect(b).toEqual(a);
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(1);
  });

  it('a decision that lost a race writes nothing more (the pending check is in the UPDATE)', async () => {
    const { h, post, pending, order, approvalsService } = await setup();
    const p = await pending('m2', 'x-guksu');
    const stale = approvalsService.findForUser(p.approvalId, 'u1');
    await post('u1', `/api/approvals/${p.approvalId}/reject`);
    vi.spyOn(approvalsService, 'findForUser').mockReturnValueOnce(stale);
    const late = await post('u1', `/api/approvals/${p.approvalId}/approve`);
    expect(late.status).toBe(200);
    expect(zApprovalDecision.parse(late.body).approval.status).toBe('rejected');
    expect(order(p.orderId)?.status).toBe('failed');
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(0);
  });

  it('is 404 for another user approval and 401 without a session', async () => {
    const { http, post, pending } = await setup();
    const p = await pending('m2', 'x-guksu');
    expect((await post('u2', `/api/approvals/${p.approvalId}/approve`)).status).toBe(404);
    expect((await http().post(`/api/approvals/${p.approvalId}/approve`)).status).toBe(401);
  });

  it('an expired approval cannot be approved: it answers expired and the order failed', async () => {
    const { post, pending, order } = await setup();
    const p = await pending('m2', 'x-guksu');
    vi.setSystemTime(NOW + 600_000);
    const d = zApprovalDecision.parse(
      (await post('u1', `/api/approvals/${p.approvalId}/approve`)).body,
    );
    expect(d.approval.status).toBe('expired');
    expect(d.order.status).toBe('failed');
    expect(order(p.orderId)?.errorCode).toBe('SERVER_NEW_MERCHANT');
  });
});

describe('POST /api/approvals/:id/reject', () => {
  it('fails the order for good with the reason code; its card then pays nothing', async () => {
    const { h, post, pending, order, payment } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const p = await pending('m2', 'x-guksu');
    const d = zApprovalDecision.parse(
      (await post('u1', `/api/approvals/${p.approvalId}/reject`)).body,
    );
    expect(d).toEqual({
      approval: { id: p.approvalId, status: 'rejected' },
      order: { id: p.orderId, status: 'failed' },
    });
    expect(order(p.orderId)?.errorCode).toBe('SERVER_NEW_MERCHANT');
    const again = zOrderResult.parse((await post('u1', `/api/orders/${p.orderId}/confirm`)).body);
    expect(again.order.status).toBe('failed');
    expect(pay).not.toHaveBeenCalled();
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(0);
  });

  it('another user cannot reject it: 404, the approval stays pending and the order waiting', async () => {
    const { h, post, pending, order } = await setup();
    const p = await pending('m2', 'x-guksu');
    expect((await post('u2', `/api/approvals/${p.approvalId}/reject`)).status).toBe(404);
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(order(p.orderId)?.status).toBe('pending_approval');
  });

  it('another user listing cannot expire this user approvals', async () => {
    const { h, get, pending, order } = await setup();
    const p = await pending('m2', 'x-guksu');
    vi.setSystemTime(NOW + 600_000);
    await get('u2', '/api/approvals');
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(order(p.orderId)?.status).toBe('pending_approval');
  });

  it('rejecting a budget overrun keeps SERVER_BUDGET_OVER on the order', async () => {
    const { h, post, pending, order } = await setup();
    h.db
      .insert(orders)
      .values({
        id: 'p0',
        orderRef: `0x${'1'.repeat(64)}`,
        userId: 'u1',
        agentId: 'a-u1',
        merchantId: 'm1',
        amountAokrw: W('292000'),
        itemsJson: '[]',
        status: 'paid',
        createdAt: NOW,
        updatedAt: NOW,
      })
      .run();
    const p = await pending('m1', 'x-dwaeji');
    await post('u1', `/api/approvals/${p.approvalId}/reject`);
    expect(order(p.orderId)).toMatchObject({ status: 'failed', errorCode: 'SERVER_BUDGET_OVER' });
  });

  it('if the order already left pending_approval, approving writes nothing (one transaction)', async () => {
    const { h, post, pending } = await setup();
    const p = await pending('m2', 'x-guksu');
    h.db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, p.orderId)).run();
    const res = await post('u1', `/api/approvals/${p.approvalId}/approve`);
    expect(res.status).toBe(500);
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(
      h.db.select().from(allowedMerchants).where(eq(allowedMerchants.merchantId, 'm2')).all(),
    ).toHaveLength(0);
  });
});
