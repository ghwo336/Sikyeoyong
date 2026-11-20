import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type AgentWallet, type PaymentProvider, zAgentSetupView } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agentLimitHistory, agents, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsModule } from './agents.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(override?: (p: PaymentProvider) => PaymentProvider) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  for (const id of ['u1', 'u2'])
    h.db.insert(users).values({ id, nickname: id, monthlyBudgetAokrw: '1', createdAt: 1 }).run();
  let builder = Test.createTestingModule({ imports: [AgentsModule] }).useMocker((t) =>
    t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
  );
  const moduleRef0 = await builder.compile();
  if (override !== undefined) {
    const real = moduleRef0.get<PaymentProvider>(PAYMENT_PROVIDER);
    builder = Test.createTestingModule({ imports: [AgentsModule] })
      .useMocker((t) =>
        t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
      )
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(override(real));
  }
  const moduleRef = override === undefined ? moduleRef0 : await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const tokens = {
    u1: moduleRef.get(AuthService).issue('u1', 'web'),
    u2: moduleRef.get(AuthService).issue('u2', 'web'),
  };
  const http = () => request(app.getHttpServer() as Server);
  const as = (who: 'u1' | 'u2') => ({
    post: (path: string, body: object = {}) =>
      http()
        .post(path)
        .set('Cookie', `sid=${tokens[who]}`)
        .set('X-Requested-With', 'fetch')
        .send(body),
    get: (path: string) => http().get(path).set('Cookie', `sid=${tokens[who]}`),
  });
  const settle = async () => {
    const row = h.db.select().from(agents).all()[0];
    if (row !== undefined) await moduleRef.get(AgentSetupService).run(row.id);
  };
  return { h, as, http, settle };
}

describe('POST /api/agents and hatching (user-flow 4)', () => {
  it('creates a PENDING dragon, hatches it and records the level-1 TransferLimit before ACTIVE', async () => {
    const { h, as, settle } = await setup();
    const res = await as('u1').post('/api/agents', {
      dragonName: ' 봄봄 ',
      dragonSpecies: 'flower',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ agent: { status: 'PENDING' } });
    await settle();
    const view = zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body);
    expect(view).toEqual({
      status: 'ACTIVE',
      steps: [
        { key: 'wallet', status: 'done' },
        { key: 'identity', status: 'done' },
        { key: 'limit', status: 'done' },
      ],
    });
    const row = h.db.select().from(agents).all()[0];
    expect(row).toMatchObject({
      dragonName: '봄봄',
      status: 'ACTIVE',
      setupStep: 'done',
      paymentPath: 'mock',
    });
    expect(row?.walletAddress).toMatch(/^0x[0-9a-f]{40}$/);
    expect(h.db.select().from(agentLimitHistory).all()).toEqual([
      expect.objectContaining({ level: 1, transferLimitAokrw: '10000000000000000000000' }),
    ]);
  });

  it('allows one dragon per user (409) and checks the body', async () => {
    const { as } = await setup();
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    expect(
      (await as('u1').post('/api/agents', { dragonName: '둘째', dragonSpecies: 'star' })).status,
    ).toBe(409);
    expect(
      (await as('u2').post('/api/agents', { dragonName: '   ', dragonSpecies: 'star' })).status,
    ).toBe(400);
    expect(
      (await as('u2').post('/api/agents', { dragonName: '용', dragonSpecies: 'fire' })).status,
    ).toBe(400);
  });

  it('shows the step that failed and stays not ACTIVE, then a retry finishes it', async () => {
    let failLimit = true;
    const { h, as, settle } = await setup((real) =>
      // Keep every real method (prototype included) and replace only the TransferLimit write.
      Object.assign(Object.create(real) as PaymentProvider, {
        setTransferLimit: (a: AgentWallet, amount: bigint) =>
          failLimit ? Promise.reject(new Error('rpc down')) : real.setTransferLimit(a, amount),
      }),
    );
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'water' });
    await settle();
    expect(zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body)).toEqual({
      status: 'FAILED',
      steps: [
        { key: 'wallet', status: 'done' },
        { key: 'identity', status: 'done' },
        { key: 'limit', status: 'failed' },
      ],
    });
    expect(h.db.select().from(agents).all()[0]?.status).toBe('PENDING');
    expect(h.db.select().from(agentLimitHistory).all()).toHaveLength(0);
    failLimit = false;
    const retry = await as('u1').post('/api/agents/me/setup/retry');
    expect(retry.status).toBe(200);
    await settle();
    expect(zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body).status).toBe(
      'ACTIVE',
    );
  });

  it('is 404 before a dragon exists and 401 without a session', async () => {
    const { as, http } = await setup();
    expect((await as('u2').get('/api/agents/me')).status).toBe(404);
    expect((await http().get('/api/agents/me')).status).toBe(401);
  });
});
