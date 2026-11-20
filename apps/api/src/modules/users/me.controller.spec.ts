import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zMeView, zSignupConfig } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { UsersModule } from './users.module.js';

// Amounts written by hand: N won = N * 10^18 aokrw.
const W = (won: string) => `${won}000000000000000000`;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', myPeriodicLimitAokrw: W('300000'), createdAt: 1 })
    .run();
  h.db
    .insert(users)
    .values({ id: 'u2', nickname: '새 주인', myPeriodicLimitAokrw: W('300000'), createdAt: 1 })
    .run();
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '봄봄',
      dragonSpecies: 'star',
      paymentPath: 'B',
      perOrderLimitAokrw: '50000000000000000000000',
      createdAt: 1,
    })
    .run();
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const http = () => request(app.getHttpServer() as Server);
  const as = (who: 'u1' | 'u2') => ({
    get: (path: string) => http().get(path).set('Cookie', `sid=${tokens[who]}`),
    patch: (path: string, body: object) =>
      http()
        .patch(path)
        .set('Cookie', `sid=${tokens[who]}`)
        .set('X-Requested-With', 'fetch')
        .send(body),
  });
  return { http, as, h };
}

describe('GET /api/me', () => {
  it('shows the dragon and its per-order limit, no level (D-31)', async () => {
    const { as } = await setup();
    const res = await as('u1').get('/api/me');
    expect(res.status).toBe(200);
    expect(zMeView.parse(res.body)).toEqual({
      dragonName: '봄봄',
      dragonSpecies: 'star',
      perOrderLimit: W('50000'),
      custodial: true,
    });
  });

  it('says custodial only while OWNER_MODE is custodial (D-24: the trial line goes away with pouch)', async () => {
    const pouch = await setup({ OWNER_MODE: 'pouch' });
    expect((await pouch.as('u1').get('/api/me')).body).toMatchObject({ custodial: false });
    const custodial = await setup({ OWNER_MODE: 'custodial' });
    expect((await custodial.as('u1').get('/api/me')).body).toMatchObject({ custodial: true });
  });

  it('is 404 before the dragon exists, 401 without a session', async () => {
    const { as, http } = await setup();
    expect((await as('u2').get('/api/me')).status).toBe(404);
    expect((await http().get('/api/me')).status).toBe(401);
  });
});

describe('PATCH /api/me (gone, D-31)', () => {
  it('no longer changes the budget: the 30-day limit moved to PUT /agents/me/limits', async () => {
    const { as, h } = await setup();
    const res = await as('u1').patch('/api/me', { monthlyBudgetOkrw: W('200000') });
    expect(res.status).toBe(404);
    expect(
      h.db
        .select()
        .from(users)
        .all()
        .map((u) => u.myPeriodicLimitAokrw),
    ).toEqual([W('300000'), W('300000')]);
  });
});

describe('GET /api/signup/config', () => {
  it('is public and follows the server settings (D-16)', async () => {
    const { http } = await setup({ VERIFY_MODE: 'mock' });
    const res = await http().get('/api/signup/config');
    expect(res.status).toBe(200);
    expect(zSignupConfig.parse(res.body)).toEqual({
      verifyMode: 'mock',
      trialAllowance: W('100000'),
    });
  });
});
