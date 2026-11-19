import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, zBudgetView } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { BudgetModule } from './budget.module.js';

const s = (won: bigint) => okrwToAokrw(won).toString();

describe('GET /api/budget', () => {
  let app: INestApplication;
  let h: DbHandle;
  let tokens: { u1: string; u2: string };
  const http = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    h = openDb(':memory:');
    runMigrations(h.db);
    for (const [id, budget, level] of [
      ['u1', 200_000n, 1],
      ['u2', 500_000n, 3],
    ] as const) {
      h.db
        .insert(users)
        .values({ id, nickname: id, monthlyBudgetAokrw: s(budget), createdAt: 1 })
        .run();
      h.db
        .insert(agents)
        .values({
          id: `a-${id}`,
          userId: id,
          dragonName: '용이',
          dragonSpecies: 'forest',
          paymentPath: 'B',
          level,
          createdAt: 1,
        })
        .run();
    }
    const moduleRef = await Test.createTestingModule({ imports: [BudgetModule] })
      .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    const auth = moduleRef.get(AuthService);
    tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'native') };
  });

  afterAll(async () => {
    await app.close();
    h.close();
  });

  it('answers 401 without a session', async () => {
    expect((await http().get('/api/budget')).status).toBe(401);
  });

  it('returns the session user BudgetView, valid against the shared schema', async () => {
    const res = await http().get('/api/budget').set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(200);
    const view = zBudgetView.parse(res.body);
    expect(view.personalBudget).toBe(s(200_000n));
    expect(view.level).toBe(1);
    expect(view.perOrderLimit).toBe(s(10_000n));
  });

  it('shows each user only their own budget, whatever the query says', async () => {
    const res = await http()
      .get('/api/budget?userId=u1')
      .set('Authorization', `Bearer ${tokens.u2}`);
    const view = zBudgetView.parse(res.body);
    expect(view.personalBudget).toBe(s(500_000n));
    expect(view.level).toBe(3);
  });
});
