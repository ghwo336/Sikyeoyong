import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AgentWallet,
  type OwnerAuthority,
  type PaymentProvider,
  zAgentSetupView,
} from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agentLimitHistory, agents, identityChecks, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { CustodialOwner, OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsModule } from './agents.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(override?: (p: PaymentProvider) => PaymentProvider, owner?: OwnerAuthority) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  for (const id of ['u1', 'u2', 'u3']) {
    h.db.insert(users).values({ id, nickname: id, myPeriodicLimitAokrw: '1', createdAt: 1 }).run();
  }
  // D-16: u1 and u2 passed the identity check; u3 has not.
  for (const id of ['u1', 'u2']) {
    h.db.insert(identityChecks).values({ userId: id, method: 'mock', verifiedAt: 1 }).run();
  }
  let builder = Test.createTestingModule({ imports: [AgentsModule] }).useMocker((t) =>
    t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
  );
  const moduleRef0 = await builder.compile();
  if (override !== undefined || owner !== undefined) {
    const real = moduleRef0.get<PaymentProvider>(PAYMENT_PROVIDER);
    builder = Test.createTestingModule({ imports: [AgentsModule] }).useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
    );
    if (override !== undefined) {
      const fake = override(real);
      builder = builder
        .overrideProvider(PAYMENT_PROVIDER)
        .useValue(fake)
        .overrideProvider(OWNER_AUTHORITY)
        .useValue(owner ?? new CustodialOwner(fake));
    } else if (owner !== undefined) {
      builder = builder.overrideProvider(OWNER_AUTHORITY).useValue(owner);
    }
  }
  const moduleRef =
    override === undefined && owner === undefined ? moduleRef0 : await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const tokens = {
    u1: moduleRef.get(AuthService).issue('u1', 'web'),
    u2: moduleRef.get(AuthService).issue('u2', 'web'),
    u3: moduleRef.get(AuthService).issue('u3', 'web'),
  };
  const http = () => request(app.getHttpServer() as Server);
  const as = (who: 'u1' | 'u2' | 'u3') => ({
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
  it('creates a PENDING dragon, hatches it and records the first TransferLimit (policy.perOrderLimit.initial, D-31) before ACTIVE', async () => {
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
      perOrderLimitAokrw: '10000000000000000000000',
    });
    expect(row?.walletAddress).toMatch(/^0x[0-9a-f]{40}$/);
    expect(h.db.select().from(agentLimitHistory).all()).toEqual([
      expect.objectContaining({ transferLimitAokrw: '10000000000000000000000' }),
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

  it('as the owner, binds the agent and then writes its TransferLimit, once each, before ACTIVE', async () => {
    const calls: string[] = [];
    const { as, settle } = await setup((real) =>
      Object.assign(Object.create(real) as PaymentProvider, {
        bindAgent: (a: AgentWallet) => {
          calls.push('bind');
          return real.bindAgent(a);
        },
        setTransferLimit: (a: AgentWallet, amount: bigint) => {
          calls.push(`limit:${amount.toString()}`);
          return real.setTransferLimit(a, amount);
        },
      }),
    );
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    await settle();
    expect(calls).toEqual(['bind', 'limit:10000000000000000000000']);
    expect(zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body).status).toBe(
      'ACTIVE',
    );
  });

  it('stays not ACTIVE when binding fails, and a retry finishes it', async () => {
    let failBind = true;
    const { h, as, settle } = await setup((real) =>
      Object.assign(Object.create(real) as PaymentProvider, {
        bindAgent: (a: AgentWallet) =>
          failBind ? Promise.reject(new Error('rpc down')) : real.bindAgent(a),
      }),
    );
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    await settle();
    expect(zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body).status).toBe(
      'FAILED',
    );
    expect(h.db.select().from(agents).all()[0]?.status).toBe('PENDING');
    expect(h.db.select().from(agentLimitHistory).all()).toHaveLength(0);
    failBind = false;
    await as('u1').post('/api/agents/me/setup/retry');
    await settle();
    expect(zAgentSetupView.parse((await as('u1').get('/api/agents/me')).body).status).toBe(
      'ACTIVE',
    );
  });

  it('never turns ACTIVE when the owner must sign on the device (pouch)', async () => {
    const confirm = vi.fn();
    const userSigns: OwnerAuthority = {
      mode: 'pouch',
      prepare: (action) => Promise.resolve({ id: 'p1', action, signer: 'user' }),
      confirm,
    };
    const { h, as, settle } = await setup(undefined, userSigns);
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    await settle();
    expect(h.db.select().from(agents).all()[0]?.status).toBe('PENDING');
    expect(h.db.select().from(agentLimitHistory).all()).toHaveLength(0);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stays not ACTIVE when the TransferLimit write returns no transaction', async () => {
    let inner: OwnerAuthority | undefined;
    const noTx: OwnerAuthority = {
      mode: 'custodial',
      prepare: (action) => (inner as OwnerAuthority).prepare(action),
      confirm: (prepared) =>
        prepared.action.kind === 'setTransferLimit'
          ? Promise.resolve({ txHashes: [] })
          : (inner as OwnerAuthority).confirm(prepared),
    };
    const { h, as, settle } = await setup((real) => {
      inner = new CustodialOwner(real);
      return real;
    }, noTx);
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    await settle();
    const row = h.db.select().from(agents).all()[0];
    expect(row?.status).toBe('PENDING');
    expect(row?.setupStep).toBe('failed');
    expect(h.db.select().from(agentLimitHistory).all()).toHaveLength(0);
  });

  it('never turns ACTIVE when only the bind still needs the owner signature', async () => {
    // Bind waits for the user's device; the TransferLimit would go through. Still not ACTIVE.
    let inner: OwnerAuthority | undefined;
    const bindNeedsUser: OwnerAuthority = {
      mode: 'pouch',
      prepare: (action) =>
        action.kind === 'bind'
          ? Promise.resolve({ id: 'b1', action, signer: 'user' })
          : (inner as OwnerAuthority).prepare(action),
      confirm: (prepared) => (inner as OwnerAuthority).confirm(prepared),
    };
    const { h, as, settle } = await setup((real) => {
      inner = new CustodialOwner(real);
      return real;
    }, bindNeedsUser);
    await as('u1').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    await settle();
    expect(h.db.select().from(agents).all()[0]?.status).toBe('PENDING');
    expect(h.db.select().from(agentLimitHistory).all()).toHaveLength(0);
  });

  it('refuses to hatch before the identity check (D-16): 403, no dragon written', async () => {
    const { h, as } = await setup();
    const res = await as('u3').post('/api/agents', { dragonName: '용이', dragonSpecies: 'forest' });
    expect(res.status).toBe(403);
    expect(h.db.select().from(agents).all()).toHaveLength(0);
  });

  it('is 404 before a dragon exists and 401 without a session', async () => {
    const { as, http } = await setup();
    expect((await as('u2').get('/api/agents/me')).status).toBe(404);
    expect((await http().get('/api/agents/me')).status).toBe(401);
  });
});
