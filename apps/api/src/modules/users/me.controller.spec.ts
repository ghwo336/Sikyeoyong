import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zBudgetView, zMeView, zSignupConfig, zUserView } from '@sikyeoyong/shared';
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
import { BudgetModule } from '../budget/budget.module.js';
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
    .values({ id: 'u1', nickname: '주인님', monthlyBudgetAokrw: W('300000'), createdAt: 1 })
    .run();
  h.db
    .insert(users)
    .values({ id: 'u2', nickname: '새 주인', monthlyBudgetAokrw: W('300000'), createdAt: 1 })
    .run();
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '봄봄',
      dragonSpecies: 'star',
      paymentPath: 'B',
      level: 3,
      createdAt: 1,
    })
    .run();
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule, BudgetModule] })
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
  it('shows the dragon, its level and that level per-order limit', async () => {
    const { as } = await setup();
    const res = await as('u1').get('/api/me');
    expect(res.status).toBe(200);
    expect(zMeView.parse(res.body)).toEqual({
      dragonName: '봄봄',
      dragonSpecies: 'star',
      level: 3,
      perOrderLimit: W('50000'),
    });
  });

  it('is 404 before the dragon exists, 401 without a session', async () => {
    const { as, http } = await setup();
    expect((await as('u2').get('/api/me')).status).toBe(404);
    expect((await http().get('/api/me')).status).toBe(401);
  });
});

describe('PATCH /api/me', () => {
  it('sets the budget to a policy option at once', async () => {
    const { as, h } = await setup();
    const res = await as('u1').patch('/api/me', { monthlyBudgetOkrw: W('200000') });
    expect(res.status).toBe(200);
    expect(zUserView.parse(res.body)).toEqual({
      user: { nickname: '주인님', monthlyBudget: W('200000') },
    });
    // Shows at once in the budget screen, and touches no one else.
    const budget = zBudgetView.parse((await as('u1').get('/api/budget')).body);
    expect(budget.personalBudget).toBe(W('200000'));
    const others = h.db
      .select()
      .from(users)
      .all()
      .filter((u) => u.id !== 'u1');
    expect(others.map((u) => u.monthlyBudgetAokrw)).toEqual([W('300000')]);
  });

  it('refuses other amounts, extra fields and cookie writes without the CSRF header', async () => {
    const { as, http } = await setup();
    expect((await as('u1').patch('/api/me', { monthlyBudgetOkrw: W('250000') })).status).toBe(400);
    expect((await as('u1').patch('/api/me', { monthlyBudgetOkrw: 200000 })).status).toBe(400);
    expect(
      (await as('u1').patch('/api/me', { monthlyBudgetOkrw: W('200000'), role: 'operator' }))
        .status,
    ).toBe(400);
    expect(
      (
        await http()
          .patch('/api/me')
          .send({ monthlyBudgetOkrw: W('200000') })
      ).status,
    ).toBe(401);
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
