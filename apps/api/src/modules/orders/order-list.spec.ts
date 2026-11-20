import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ORDER_LIST_MAX, zOrderList, zOrderResult } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { OrdersModule } from './orders.module.js';
import type { OrderStatus } from './orders.repository.js';

const NOW = Date.parse('2026-12-10T03:00:00.000Z');
const MIN = 60_000;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string> = { PAYMENT_PATH: 'mock' }) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  insertUser(h.db, 'u2');
  insertMerchant(h.db, 'm1', { name: '마루국밥' });
  const moduleRef = await Test.createTestingModule({ imports: [OrdersModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const http = () => request(app.getHttpServer() as Server);
  const get = (who: 'u1' | 'u2', path: string) =>
    http().get(path).set('Cookie', `sid=${tokens[who]}`);
  return { h, http, get };
}

function order(
  h: DbHandle,
  id: string,
  createdAt: number,
  status: OrderStatus = 'paid',
  userId: 'u1' | 'u2' = 'u1',
) {
  const started = ['paid', 'submitting', 'failed'].includes(status) ? createdAt : null;
  h.db
    .insert(orders)
    .values({
      id,
      orderRef: `0x${id.padStart(64, '0')}`,
      userId,
      agentId: `a-${userId}`,
      merchantId: 'm1',
      amountAokrw: '9000000000000000000000',
      itemsJson: JSON.stringify([
        { menuId: 'x1', name: '돼지국밥', quantity: 1, price: '9000000000000000000000' },
      ]),
      status,
      errorCode: status === 'failed' ? 'CHAIN_AGENT_LIMIT' : null,
      submitStartedAt: started,
      createdAt,
      updatedAt: createdAt,
    })
    .run();
}

describe('GET /api/orders (recent orders, D-32 Main)', () => {
  it('lists the own orders newest first, leaves out quoted ones, and keeps pending_approval', async () => {
    const { h, get } = await setup();
    order(h, 'o-old', NOW - 30 * MIN);
    order(h, 'o-quoted', NOW - 20 * MIN, 'quoted');
    order(h, 'o-wait', NOW - 10 * MIN, 'pending_approval');
    order(h, 'o-fail', NOW - 5 * MIN, 'failed');
    order(h, 'o-new', NOW - 1 * MIN);
    order(h, 'o-other', NOW, 'paid', 'u2');
    const res = await get('u1', '/api/orders');
    expect(res.status).toBe(200);
    const list = zOrderList.parse(res.body);
    expect(list.orders.map((o) => o.id)).toEqual(['o-new', 'o-fail', 'o-wait', 'o-old']);
  });

  it('builds each item exactly like GET /orders/:id, simulated delivery stages included', async () => {
    const { h, get } = await setup();
    order(h, 'o-done', NOW - 60 * MIN);
    order(h, 'o-mid', NOW - 1 * MIN);
    order(h, 'o-just', NOW);
    order(h, 'o-wait', NOW - 2 * MIN, 'pending_approval');
    order(h, 'o-fail', NOW - 3 * MIN, 'failed');
    const list = zOrderList.parse((await get('u1', '/api/orders')).body);
    const statuses = new Set(list.orders.map((o) => o.status));
    // The mock chain plays the stages out, so the list shows more than the stored 'paid'.
    expect(statuses.has('delivered')).toBe(true);
    expect(statuses.has('pending_approval')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
    for (const item of list.orders) {
      const one = zOrderResult.parse((await get('u1', `/api/orders/${item.id}`)).body);
      expect(item).toEqual(one.order);
    }
  });

  it('shows the stored status on a real path outside the demo, like GET /orders/:id', async () => {
    const { h, get } = await setup({ PAYMENT_PATH: 'B', DEMO_MODE: 'false' });
    order(h, 'o-done', NOW - 60 * MIN);
    const list = zOrderList.parse((await get('u1', '/api/orders')).body);
    expect(list.orders.map((o) => o.status)).toEqual(['paid']);
  });

  it(`answers at most ORDER_LIST_MAX (${ORDER_LIST_MAX}), the newest ones`, async () => {
    const { h, get } = await setup();
    for (let i = 0; i < ORDER_LIST_MAX + 5; i += 1) {
      order(h, `o${String(i).padStart(3, '0')}`, NOW - (100 - i) * MIN);
    }
    const list = zOrderList.parse((await get('u1', '/api/orders')).body);
    expect(list.orders).toHaveLength(ORDER_LIST_MAX);
    expect(list.orders[0]?.id).toBe(`o${String(ORDER_LIST_MAX + 4).padStart(3, '0')}`);
    expect(list.orders.at(-1)?.id).toBe('o005');
  });

  it('is an empty list with no orders, and 401 without a session', async () => {
    const { h, get, http } = await setup();
    order(h, 'o-other', NOW, 'paid', 'u2');
    expect(zOrderList.parse((await get('u1', '/api/orders')).body)).toEqual({ orders: [] });
    expect((await http().get('/api/orders')).status).toBe(401);
  });
});
