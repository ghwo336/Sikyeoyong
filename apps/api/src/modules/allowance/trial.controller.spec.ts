import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, zTrialResult } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { identityChecks, ownerAllowanceEntries } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { AllowanceModule } from './allowance.module.js';
import { AllowanceService } from './allowance.service.js';

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
  const moduleRef = await Test.createTestingModule({ imports: [AllowanceModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const claim = () =>
    http().post('/api/signup/trial').set('Cookie', `sid=${token}`).set('X-Requested-With', 'fetch');
  return { h, http, claim, token, allowance: moduleRef.get(AllowanceService) };
}

describe('POST /api/signup/trial (user-flow 5)', () => {
  it('grants the policy trial allowance once: 100,000 won in the owner ledger', async () => {
    const { claim, allowance } = await setup();
    const first = await claim();
    expect(first.status).toBe(200);
    expect(zTrialResult.parse(first.body)).toEqual({ granted: true });
    // By hand: 100,000 won = 100000 * 10^18 aokrw (policy default).
    expect(allowance.balanceAokrw('u1')).toBe(okrwToAokrw(100_000n));
  });

  it('a second claim is 200 granted false and adds nothing, even when sent together', async () => {
    const { claim, allowance, h } = await setup();
    const both = await Promise.all([claim(), claim()]);
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(both.map((r) => (r.body as { granted: boolean }).granted).sort()).toEqual([false, true]);
    expect((await claim()).body).toEqual({ granted: false });
    expect(h.db.select().from(ownerAllowanceEntries).all()).toHaveLength(1);
    expect(allowance.balanceAokrw('u1')).toBe(okrwToAokrw(100_000n));
  });

  it('an owner without the identity check gets 403 and nothing', async () => {
    const { h, claim, allowance } = await setup();
    h.db.delete(identityChecks).run();
    expect((await claim()).status).toBe(403);
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('needs a session and the fetch header', async () => {
    const { http, token, allowance } = await setup();
    expect((await http().post('/api/signup/trial')).status).toBe(401);
    expect((await http().post('/api/signup/trial').set('Cookie', `sid=${token}`)).status).toBe(403);
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });
});
