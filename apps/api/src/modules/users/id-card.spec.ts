import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zIdCardView } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, identityChecks, users } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { UsersModule } from './users.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

// 2026-12-01 00:00 KST, written out by hand.
const BORN = Date.parse('2026-12-01T00:00:00+09:00');

async function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  h.db.update(users).set({ nickname: '호재' }).where(eq(users.id, 'u1')).run();
  h.db.update(agents).set({ createdAt: BORN }).where(eq(agents.id, 'a-u1')).run();
  const moduleRef = await Test.createTestingModule({ imports: [UsersModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const http = () => request(app.getHttpServer() as Server);
  const get = (user: string) =>
    http()
      .get('/api/me/id-card')
      .set('Cookie', `sid=${auth.issue(user, 'web')}`);
  return { h, http, get };
}

describe('GET /api/me/id-card (IdCard.dc.html)', () => {
  it("shows the owner's name, the identity check and when the dragon was asked for", async () => {
    const { get } = await setup();
    const res = await get('u1');
    expect(res.status).toBe(200);
    expect(zIdCardView.parse(res.body)).toEqual({
      ownerName: '호재',
      ownerVerified: true,
      bornAt: BORN,
    });
  });

  it('an owner without the identity check shows as not verified', async () => {
    const { h, get } = await setup();
    h.db.delete(identityChecks).where(eq(identityChecks.userId, 'u1')).run();
    expect(zIdCardView.parse((await get('u1')).body).ownerVerified).toBe(false);
  });

  it('a long name keeps whole characters (32, emoji not cut); an empty name shows 주인님', async () => {
    const { h, get } = await setup();
    const long = `${'가'.repeat(31)}🐉🐉`;
    h.db.update(users).set({ nickname: long }).where(eq(users.id, 'u1')).run();
    expect(zIdCardView.parse((await get('u1')).body).ownerName).toBe(`${'가'.repeat(31)}🐉`);
    h.db.update(users).set({ nickname: '' }).where(eq(users.id, 'u1')).run();
    expect(zIdCardView.parse((await get('u1')).body).ownerName).toBe('주인님');
  });

  it('a user without a dragon gets 404; no session gets 401', async () => {
    const { h, http, get } = await setup();
    h.db
      .insert(users)
      .values({ id: 'u2', nickname: 'u2', monthlyBudgetAokrw: '1', createdAt: 1 })
      .run();
    expect((await get('u2')).status).toBe(404);
    expect((await http().get('/api/me/id-card')).status).toBe(401);
  });
});
