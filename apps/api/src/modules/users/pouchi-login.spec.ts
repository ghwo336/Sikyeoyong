import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zPouchiLoginConfig } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { pouchiAccounts, users } from '../../db/schema/index.js';
import {
  POUCHI_BRIDGE,
  type PouchiBridge,
  type PouchiBridgeOutcome,
  PouchiService,
} from '../pouchi/pouchi.service.js';
import { UsersModule } from './users.module.js';

const ON = {
  PUBLIC_BASE_URL: 'http://localhost:3000',
  POUCHI_API_URL: 'https://pouchi.example',
  POUCHI_TENANT_ID: 't1',
  POUCHI_APP_KEY: 'secret-key',
  POUCHI_APP_ID: 'sikyeoyong',
};

const WALLET = { walletId: 'w-1', walletAddress: `0x${'a'.repeat(40)}` };
const VERIFIER = 'v'.repeat(43);

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string> = ON) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  let next: PouchiBridgeOutcome = { ok: true, ownerVerified: true, ...WALLET };
  const complete = vi.fn((_input: unknown) => Promise.resolve(next));
  const bridge: PouchiBridge = { complete };
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
    .overrideProvider(POUCHI_BRIDGE)
    .useValue(bridge)
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const http = () => request(app.getHttpServer() as Server);
  const post = (path: string, body: object) =>
    http().post(`/api/auth/pouchi/${path}`).set('X-Requested-With', 'fetch').send(body);
  const login = async (requestId: string) => {
    await post('bind', { requestId, codeChallenge: 'c', flow: 'signup' });
    return post('complete', { envelope: 'e', codeVerifier: VERIFIER, requestId });
  };
  const outcome = (o: PouchiBridgeOutcome) => {
    next = o;
  };
  return { h, http, post, login, outcome, complete, service: moduleRef.get(PouchiService) };
}

const sidOf = (res: { headers: Record<string, unknown> }): string | undefined => {
  const raw: unknown = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
  return cookies.find((c) => c.startsWith('sid='));
};

describe('Pouchi login (D-29)', () => {
  it('the public config: vault, app id and our callback, no key', async () => {
    const { http } = await setup();
    const res = await http().get('/api/auth/pouchi/config');
    expect(zPouchiLoginConfig.parse(res.body)).toEqual({
      vaultUrl: 'https://auth.pouchi.io',
      appId: 'sikyeoyong',
      callbackUrl: 'http://localhost:3000/pouchi/callback',
    });
    expect(JSON.stringify(res.body)).not.toContain('secret-key');
  });

  it('is 404 when Pouchi login is off', async () => {
    const { http, post } = await setup({});
    expect((await http().get('/api/auth/pouchi/config')).status).toBe(404);
    expect(
      (await post('bind', { requestId: 'r1', codeChallenge: 'c', flow: 'signup' })).status,
    ).toBe(404);
  });

  it('bind then complete: a session cookie, a new user 주인님 linked to the wallet', async () => {
    const { h, login, complete } = await setup();
    const res = await login('r1');
    expect(res.status).toBe(204);
    const sid = sidOf(res);
    expect(sid).toMatch(/HttpOnly/);
    expect(sid).toMatch(/SameSite=Lax/);
    expect(complete).toHaveBeenCalledWith({
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: 'r1',
      flow: 'signup',
    });
    const linked = h.db.select().from(pouchiAccounts).all();
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject(WALLET);
    const user = h.db.select().from(users).all();
    expect(user.map((u) => [u.id, u.nickname])).toEqual([[linked[0]?.userId, '주인님']]);
  });

  it('the same wallet logs in to the same user', async () => {
    const { h, login } = await setup();
    await login('r1');
    expect((await login('r2')).status).toBe(204);
    expect(h.db.select().from(users).all()).toHaveLength(1);
  });

  it('a request is redeemed once; an unbound one is refused', async () => {
    const { post, login } = await setup();
    await login('r1');
    const again = await post('complete', {
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: 'r1',
    });
    expect(again.status).toBe(401);
    expect(sidOf(again)).toBeUndefined();
    const unbound = await post('complete', {
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: 'x',
    });
    expect(unbound.status).toBe(401);
  });

  it.each([
    [{ ok: false, outcome: 'cancelled', error: null }],
    [{ ok: false, outcome: 'failed', error: 'BRIDGE_ENVELOPE_INVALID' }],
    [{ ok: true, ownerVerified: false, ...WALLET }],
  ] as const)('a refused or unverified result is 401 with no session and no user', async (o) => {
    const { h, login, outcome } = await setup();
    outcome(o);
    const res = await login('r1');
    expect(res.status).toBe(401);
    expect(sidOf(res)).toBeUndefined();
    expect(h.db.select().from(users).all()).toHaveLength(0);
  });

  it('an expired request is refused', async () => {
    const { service } = await setup();
    service.bind('r9', 'signup', 0);
    await expect(
      service.complete({ envelope: 'e', codeVerifier: VERIFIER, requestId: 'r9' }, 10 * 60 * 1000),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('needs the fetch header and a well-formed body', async () => {
    const { http, post } = await setup();
    expect(
      (
        await http()
          .post('/api/auth/pouchi/bind')
          .send({ requestId: 'r1', codeChallenge: 'c', flow: 'signup' })
      ).status,
    ).toBe(403);
    expect(
      (await post('complete', { envelope: 'e', codeVerifier: 'short', requestId: 'r1' })).status,
    ).toBe(400);
  });
});
