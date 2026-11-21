import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionCookieOptions } from '../../common/guards/session.guard.js';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { type AppConfig, loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { users } from '../../db/schema/index.js';
import { UsersModule } from './users.module.js';

// Pass-through spy: the real options are used, the test only sees that the controller asks for them.
vi.mock('../../common/guards/session.guard.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../common/guards/session.guard.js')>();
  return { ...real, sessionCookieOptions: vi.fn(real.sessionCookieOptions) };
});

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string>, override: Partial<AppConfig> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? { ...loadConfig(env), ...override } : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const http = () => request(app.getHttpServer() as Server);
  const login = (key: string, cookie?: string) => {
    const r = http().post('/api/auth/dev-login').set('X-Requested-With', 'fetch');
    return (cookie === undefined ? r : r.set('Cookie', cookie)).send({ key });
  };
  return { h, http, login };
}

const sidOf = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const sids = raw?.filter((x) => x.startsWith('sid=')) ?? [];
  expect(sids).toHaveLength(1); // exactly one sid cookie
  return sids[0] ?? '';
};

describe('POST /api/auth/dev-login (local development only)', () => {
  it('is 404 unless DEV_LOGIN=true', async () => {
    const { h, login } = await setup({});
    const res = await login('hojae');
    expect(res.status).toBe(404);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(h.db.select().from(users).all()).toHaveLength(0);
  });

  it('is 404 before any body check when off: a bad body tells nothing', async () => {
    const { http } = await setup({});
    const res = await http()
      .post('/api/auth/dev-login')
      .set('X-Requested-With', 'fetch')
      .send({ key: 'BAD!' });
    expect(res.status).toBe(404);
  });

  it('stays shut in production even if the config said yes (the guard checks again)', async () => {
    const { h, login } = await setup(
      { DEV_LOGIN: 'true', PAYMENT_PATH: 'mock' },
      { nodeEnv: 'production' },
    );
    const res = await login('hojae');
    expect(res.status).toBe(404);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(h.db.select().from(users).all()).toHaveLength(0);
  });

  it('makes dev-<key> with the default budget and sets an HttpOnly sid on Path=/ that /me accepts', async () => {
    const { h, http, login } = await setup({ DEV_LOGIN: 'true' });
    const res = await login('hojae');
    expect(res.status).toBe(204);
    const cookie = sidOf(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/;\s*Path=\/(;|$)/); // Path=/ exactly, not /api
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(h.db.select().from(users).where(eq(users.id, 'dev-hojae')).get()).toMatchObject({
      nickname: 'hojae',
      myPeriodicLimitAokrw: '300000000000000000000000',
    });
    const sid = cookie.split(';')[0] ?? '';
    // Signed in, no dragon yet: /me says 404, not 401 (the web goes to naming).
    expect((await http().get('/api/me').set('Cookie', sid)).status).toBe(404);
  });

  it('a second login ends the first session and keeps one user', async () => {
    const { h, http, login } = await setup({ DEV_LOGIN: 'true' });
    const first = sidOf(await login('hojae')).split(';')[0] ?? '';
    const second = sidOf(await login('hojae', first)).split(';')[0] ?? '';
    expect(second).not.toBe(first);
    expect((await http().get('/api/me').set('Cookie', first)).status).toBe(401);
    expect(h.db.select().from(users).all()).toHaveLength(1);
  });

  it('needs X-Requested-With and a plain key', async () => {
    const { http, login } = await setup({ DEV_LOGIN: 'true' });
    expect((await http().post('/api/auth/dev-login').send({ key: 'hojae' })).status).toBe(403);
    expect((await login('Hojae!')).status).toBe(400);
    expect((await login('Hojae')).status).toBe(400); // lowercase only
    expect((await login('')).status).toBe(400); // no bare "dev-" id
    expect((await login('x'.repeat(25))).status).toBe(400);
    expect((await login('x'.repeat(24))).status).toBe(204);
  });
});

describe('POST /api/auth/dev-login cookie', () => {
  it('is set with the shared sessionCookieOptions, like the other login routes', async () => {
    const { login } = await setup({ DEV_LOGIN: 'true' });
    vi.mocked(sessionCookieOptions).mockClear();
    const res = await login('hojae');
    expect(res.status).toBe(204);
    expect(sessionCookieOptions).toHaveBeenCalledTimes(1);
    const sid = sidOf(res);
    expect(sid).toContain('HttpOnly');
    expect(sid).toContain('SameSite=Lax');
    expect(sid).toContain('Path=/');
    expect(sid).toContain('Max-Age=2592000');
  });
});
