import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { orderRatings, orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { OrdersModule } from './orders.module.js';

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
  insertMerchant(h.db, 'm1');
  let seq = 0;
  const order = (userId: string, status: 'paid' | 'delivered' | 'quoted' | 'failed') => {
    seq += 1;
    const id = `o${seq}`;
    h.db
      .insert(orders)
      .values({
        id,
        userId,
        agentId: `a-${userId}`,
        merchantId: 'm1',
        itemsJson: '[]',
        amountAokrw: '9000000000000000000000',
        status,
        orderRef: `0x${String(seq).padStart(64, '0')}`,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    return id;
  };
  const moduleRef = await Test.createTestingModule({ imports: [OrdersModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const rate = (id: string, value: unknown) =>
    http()
      .post(`/api/orders/${id}/rating`)
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send({ value });
  const stored = () => h.db.select().from(orderRatings).all();
  return { order, http, rate, stored, token };
}

describe('POST /api/orders/:id/rating (Arrived.dc.html)', () => {
  it('rates a paid or delivered order; a second rating replaces the first', async () => {
    const { order, rate, stored } = await setup();
    const paid = order('u1', 'paid');
    const delivered = order('u1', 'delivered');
    expect((await rate(paid, 'again')).status).toBe(204);
    expect((await rate(delivered, 'meh')).status).toBe(204);
    expect((await rate(paid, 'okay')).status).toBe(204);
    expect(
      stored()
        .map((r) => [r.orderId, r.userId, r.value])
        .sort(),
    ).toEqual([
      ['o1', 'u1', 'okay'],
      ['o2', 'u1', 'meh'],
    ]);
  });

  it.each(['quoted', 'failed'] as const)('a %s order cannot be rated (409)', async (status) => {
    const { order, rate, stored } = await setup();
    const res = await rate(order('u1', status), 'again');
    expect(res.status).toBe(409);
    expect(stored()).toHaveLength(0);
  });

  it("someone else's order or an unknown id is 404", async () => {
    const { order, rate, stored } = await setup();
    expect((await rate(order('u2', 'paid'), 'again')).status).toBe(404);
    expect((await rate('nope', 'again')).status).toBe(404);
    expect(stored()).toHaveLength(0);
  });

  it('takes the three words only, and needs a session and the fetch header', async () => {
    const { order, rate, http, token } = await setup();
    const id = order('u1', 'paid');
    expect((await rate(id, 'great')).status).toBe(400);
    expect((await http().post(`/api/orders/${id}/rating`).send({ value: 'again' })).status).toBe(
      401,
    );
    expect(
      (
        await http()
          .post(`/api/orders/${id}/rating`)
          .set('Cookie', `sid=${token}`)
          .send({ value: 'again' })
      ).status,
    ).toBe(403);
  });
});
