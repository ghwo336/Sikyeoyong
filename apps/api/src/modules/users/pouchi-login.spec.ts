import 'reflect-metadata';
import { createHash } from 'node:crypto';
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
import { AuthService } from '../auth/auth.service.js';
import { sessionCookieOptions } from '../../common/guards/session.guard.js';
import { UsersModule } from './users.module.js';

const ON = {
  PUBLIC_BASE_URL: 'http://localhost:3000',
  POUCHI_API_URL: 'https://pouchi.example',
  POUCHI_TENANT_ID: 't1',
  POUCHI_APP_KEY: 'secret-key',
  POUCHI_APP_ID: 'sikyeoyong',
};

const WALLET = { walletId: 'w-1', walletAddress: `0x${'a'.repeat(40)}` };
// PKCE by hand: the challenge is base64url(SHA-256(verifier)), 43 characters each.
const VERIFIER = 'V'.repeat(43);
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');
const rid = (n: number) => `${'R'.repeat(40)}${String(n).padStart(3, '0')}`;

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
  const login = async (requestId: string, cookie?: string) => {
    await post('bind', { requestId, codeChallenge: CHALLENGE, flow: 'signup' });
    const req = http().post('/api/auth/pouchi/complete').set('X-Requested-With', 'fetch');
    if (cookie !== undefined) req.set('Cookie', cookie);
    return req.send({ requestId, envelope: 'e', codeVerifier: VERIFIER });
  };
  const outcome = (o: PouchiBridgeOutcome) => {
    next = o;
  };
  return {
    h,
    http,
    post,
    login,
    outcome,
    complete,
    service: moduleRef.get(PouchiService),
    auth: moduleRef.get(AuthService),
  };
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
      (await post('bind', { requestId: rid(1), codeChallenge: CHALLENGE, flow: 'signup' })).status,
    ).toBe(404);
  });

  it('bind then complete: a session cookie, a new user 주인님 linked to the wallet', async () => {
    const { h, login, complete } = await setup();
    const res = await login(rid(1));
    expect(res.status).toBe(204);
    const sid = sidOf(res);
    expect(sid).toMatch(/HttpOnly/);
    expect(sid).toMatch(/SameSite=Lax/);
    expect(complete).toHaveBeenCalledWith({
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: rid(1),
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
    await login(rid(1));
    expect((await login(rid(2))).status).toBe(204);
    expect(h.db.select().from(users).all()).toHaveLength(1);
  });

  it('a request is redeemed once; an unbound one is refused', async () => {
    const { post, login } = await setup();
    await login(rid(1));
    const again = await post('complete', {
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: rid(1),
    });
    expect(again.status).toBe(401);
    expect(sidOf(again)).toBeUndefined();
    const unbound = await post('complete', {
      envelope: 'e',
      codeVerifier: VERIFIER,
      requestId: rid(9),
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
    const res = await login(rid(1));
    expect(res.status).toBe(401);
    expect(sidOf(res)).toBeUndefined();
    expect(h.db.select().from(users).all()).toHaveLength(0);
  });

  it('an expired request is refused', async () => {
    const { service } = await setup();
    service.bind(rid(9), CHALLENGE, 'ip-a', 0);
    await expect(
      service.complete(
        { envelope: 'e', codeVerifier: VERIFIER, requestId: rid(9) },
        'ip-a',
        10 * 60 * 1000,
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('needs the fetch header and a well-formed body', async () => {
    const { http, post } = await setup();
    expect(
      (
        await http()
          .post('/api/auth/pouchi/bind')
          .send({ requestId: rid(1), codeChallenge: CHALLENGE, flow: 'signup' })
      ).status,
    ).toBe(403);
    expect(
      (await post('complete', { envelope: 'e', codeVerifier: 'short', requestId: rid(1) })).status,
    ).toBe(400);
  });

  it('a verifier that does not match the bound challenge is 401 and Pouchi is not asked', async () => {
    const { post, complete } = await setup();
    await post('bind', { requestId: rid(1), codeChallenge: CHALLENGE, flow: 'signup' });
    const res = await post('complete', {
      envelope: 'e',
      codeVerifier: 'W'.repeat(43),
      requestId: rid(1),
    });
    expect(res.status).toBe(401);
    expect(complete).not.toHaveBeenCalled();
    // The request is spent: the right verifier afterwards does not work either.
    expect(
      (await post('complete', { envelope: 'e', codeVerifier: VERIFIER, requestId: rid(1) })).status,
    ).toBe(401);
  });

  it('binding the same request twice is 409 (nobody overwrites a bound request)', async () => {
    const { post } = await setup();
    const body = { requestId: rid(1), codeChallenge: CHALLENGE, flow: 'signup' };
    expect((await post('bind', body)).status).toBe(204);
    expect((await post('bind', body)).status).toBe(409);
  });

  it('per IP: the 11th login call in a minute is 429, another address still gets in', async () => {
    const { http } = await setup();
    const bind = (n: number, ip: string) =>
      http()
        .post('/api/auth/pouchi/bind')
        .set('X-Requested-With', 'fetch')
        .set('X-Forwarded-For', ip)
        .send({ requestId: rid(n), codeChallenge: CHALLENGE, flow: 'signup' });
    for (let n = 0; n < 10; n += 1) expect((await bind(n, '203.0.113.7')).status).toBe(204);
    expect((await bind(10, '203.0.113.7')).status).toBe(429);
    expect((await bind(11, '198.51.100.2')).status).toBe(204);
  });

  it('complete counts too: the 11th call from one address in a minute is 429', async () => {
    const { http } = await setup();
    const complete = (n: number) =>
      http()
        .post('/api/auth/pouchi/complete')
        .set('X-Requested-With', 'fetch')
        .set('X-Forwarded-For', '203.0.113.9')
        .send({ requestId: rid(n), envelope: 'e', codeVerifier: VERIFIER });
    for (let n = 0; n < 10; n += 1) expect((await complete(n)).status).toBe(401);
    expect((await complete(10)).status).toBe(429);
  });

  it('the pending floor: past the cap a new bind is 429 until old ones expire', async () => {
    const { service } = await setup();
    service.maxPending = 2;
    service.bind(rid(1), CHALLENGE, 'a', 0);
    service.bind(rid(2), CHALLENGE, 'b', 0);
    expect(() => {
      service.bind(rid(3), CHALLENGE, 'c', 0);
    }).toThrow(expect.objectContaining({ code: 'RATE_LIMITED' }));
    service.bind(rid(3), CHALLENGE, 'c', 10 * 60 * 1000);
  });

  it('logging in replaces the old session: the old sid stops working (no session fixation)', async () => {
    const { h, auth, login } = await setup();
    h.db
      .insert(users)
      .values({ id: 'someone', nickname: 's', monthlyBudgetAokrw: '1', createdAt: 1 })
      .run();
    const old = auth.issue('someone', 'web');
    expect(auth.resolve(old)).not.toBeNull();
    expect((await login(rid(1), `sid=${old}`)).status).toBe(204);
    expect(auth.resolve(old)).toBeNull();
  });
});

describe('sessionCookieOptions', () => {
  it('HttpOnly, Lax, Path=/ always; Secure in production only', () => {
    expect(sessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    });
    expect(sessionCookieOptions('development').secure).toBe(false);
  });
});
