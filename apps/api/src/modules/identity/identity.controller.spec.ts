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
import { identityChecks, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { IdentityModule } from './identity.module.js';
import { IdentityService } from './identity.service.js';

const NOW = Date.parse('2026-12-10T03:00:00.000Z');
const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string>) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  for (const id of ['u1', 'u2']) {
    h.db.insert(users).values({ id, nickname: id, myPeriodicLimitAokrw: '1', createdAt: 1 }).run();
  }
  const moduleRef = await Test.createTestingModule({ imports: [IdentityModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const verify = () =>
    http()
      .post('/api/identity/verify')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch');
  return { h, http, verify, token, service: moduleRef.get(IdentityService) };
}

describe('POST /api/identity/verify (D-16)', () => {
  it('in mock mode passes and records only that it passed, for the session user', async () => {
    const { h, verify, service } = await setup({ VERIFY_MODE: 'mock' });
    expect(service.isVerified('u1')).toBe(false);
    const res = await verify();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: true });
    expect(h.db.select().from(identityChecks).all()).toEqual([
      { userId: 'u1', method: 'mock', verifiedAt: expect.any(Number) as number },
    ]);
    expect(service.isVerified('u1')).toBe(true);
    expect(service.isVerified('u2')).toBe(false);
  });

  it('a second pass keeps the first record', async () => {
    const { h, service } = await setup({ VERIFY_MODE: 'mock' });
    service.verify('u1', NOW);
    service.verify('u1', NOW + 1000);
    expect(h.db.select().from(identityChecks).get()?.verifiedAt).toBe(NOW);
  });

  it('in kakao mode refuses until the Kakao check is wired (Q-19), recording nothing', async () => {
    const { h, verify } = await setup({ VERIFY_MODE: 'kakao' });
    expect((await verify()).status).toBe(500);
    expect(h.db.select().from(identityChecks).all()).toHaveLength(0);
  });

  it('needs a session (401) and the fetch header (403)', async () => {
    const { h, http, token } = await setup({ VERIFY_MODE: 'mock' });
    expect((await http().post('/api/identity/verify')).status).toBe(401);
    const noHeader = await http().post('/api/identity/verify').set('Cookie', `sid=${token}`);
    expect(noHeader.status).toBe(403);
    expect(h.db.select().from(identityChecks).all()).toHaveLength(0);
  });
});

describe('GET /api/identity (the front door)', () => {
  it('says false before the check and true after, for the session user only; 401 without a session', async () => {
    const { http, verify, token } = await setup({ VERIFY_MODE: 'mock' });
    const get = () => http().get('/api/identity').set('Cookie', `sid=${token}`);
    expect((await get()).body).toEqual({ verified: false });
    await verify();
    expect((await get()).body).toEqual({ verified: true });
    expect((await http().get('/api/identity')).status).toBe(401);
  });
});
