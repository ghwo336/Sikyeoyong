import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type OwnerAuthority,
  type PaymentProvider,
  zMeView,
  zPatchAgentResult,
} from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agentLimitHistory, agents } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { UsersModule } from '../users/users.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

/** Spies on every method of the object, its prototype chain included. */
function spyAll(target: object): MockInstance[] {
  const spies: MockInstance[] = [];
  const seen = new Set<string>();
  for (let p: object | null = target; p !== null && p !== Object.prototype;) {
    for (const name of Object.getOwnPropertyNames(p)) {
      if (name === 'constructor' || seen.has(name)) continue;
      const desc = Object.getOwnPropertyDescriptor(p, name);
      if (typeof desc?.value !== 'function') continue;
      seen.add(name);
      spies.push(vi.spyOn(target as Record<string, () => unknown>, name));
    }
    p = Object.getPrototypeOf(p) as object | null;
  }
  return spies;
}

async function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  insertUser(h.db, 'u2', { frozen: true });
  // UsersModule brings AgentsModule, so both PATCH /agents/:id and GET /me are served.
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock' }) : undefined,
    )
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
  const row = (id: string) => h.db.select().from(agents).where(eq(agents.id, id)).get();
  const chainSpies = [
    ...spyAll(moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER)),
    ...spyAll(moduleRef.get<OwnerAuthority>(OWNER_AUTHORITY)),
  ];
  return { h, http, as, row, tokens, chainSpies };
}

describe('PATCH /api/agents/:id (Look, user-flow 18, D-32)', () => {
  it('changes only the species of the own dragon, GET /me shows it, and nothing goes on chain', async () => {
    const { h, as, row, chainSpies } = await setup();
    const before = row('a-u1');
    const res = await as('u1').patch('/api/agents/a-u1', { dragonSpecies: 'water' });
    expect(res.status).toBe(200);
    expect(zPatchAgentResult.parse(res.body)).toEqual({ dragonSpecies: 'water' });
    expect(row('a-u1')).toEqual({ ...before, dragonSpecies: 'water' });
    const me = zMeView.parse((await as('u1').get('/api/me')).body);
    expect(me).toMatchObject({ agentId: 'a-u1', dragonSpecies: 'water', dragonName: '용이' });
    expect(h.db.select().from(agentLimitHistory).all()).toEqual([]);
    expect(chainSpies.length).toBeGreaterThan(5);
    for (const spy of chainSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('is a 200 no-op for the same species', async () => {
    const { as, row } = await setup();
    const before = row('a-u1');
    const res = await as('u1').patch('/api/agents/a-u1', { dragonSpecies: 'forest' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dragonSpecies: 'forest' });
    expect(row('a-u1')).toEqual(before);
  });

  it('is allowed while frozen (it moves no money) and stays frozen', async () => {
    const { as, row } = await setup();
    const res = await as('u2').patch('/api/agents/a-u2', { dragonSpecies: 'star' });
    expect(res.status).toBe(200);
    expect(row('a-u2')).toMatchObject({ dragonSpecies: 'star', status: 'FROZEN' });
  });

  it("answers NOT_FOUND for another user's dragon and an unknown id, and changes nothing", async () => {
    const { as, row } = await setup();
    const other = await as('u1').patch('/api/agents/a-u2', { dragonSpecies: 'water' });
    const unknown = await as('u1').patch('/api/agents/nope', { dragonSpecies: 'water' });
    for (const res of [other, unknown]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
    expect(row('a-u2')?.dragonSpecies).toBe('forest');
    expect(row('a-u1')?.dragonSpecies).toBe('forest');
  });

  it('rejects an unknown species and any extra field with VALIDATION_FAILED', async () => {
    const { as, row } = await setup();
    const bad = await as('u1').patch('/api/agents/a-u1', { dragonSpecies: 'fire' });
    const extra = await as('u1').patch('/api/agents/a-u1', {
      dragonSpecies: 'water',
      dragonName: '새이름',
    });
    const empty = await as('u1').patch('/api/agents/a-u1', {});
    for (const res of [bad, extra, empty]) {
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    }
    expect(row('a-u1')).toMatchObject({ dragonSpecies: 'forest', dragonName: '용이' });
  });

  it('needs a session and the fetch header', async () => {
    const { http, tokens, row } = await setup();
    expect((await http().patch('/api/agents/a-u1').send({ dragonSpecies: 'water' })).status).toBe(
      401,
    );
    expect(
      (
        await http()
          .patch('/api/agents/a-u1')
          .set('Cookie', `sid=${tokens.u1}`)
          .send({ dragonSpecies: 'water' })
      ).status,
    ).toBe(403);
    expect(row('a-u1')?.dragonSpecies).toBe('forest');
  });
});
