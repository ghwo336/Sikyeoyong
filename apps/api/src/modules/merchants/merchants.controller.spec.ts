import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { zMerchantDetail, zMerchantList } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { MerchantsModule } from './merchants.module.js';

const errorCode = (body: unknown) => (body as { error: { code: string } }).error.code;

describe('GET /api/merchants', () => {
  let app: INestApplication;
  let h: DbHandle;
  let tokens: { u1: string; u2: string };
  const http = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    h = openDb(':memory:');
    runMigrations(h.db);
    insertUser(h.db, 'u1');
    insertUser(h.db, 'u2', { level: 3 });
    insertMerchant(h.db, 'm-gukbap', { name: '마루국밥 본점', tags: ['국물'] });
    insertMerchant(h.db, 'm-jjajang', { name: '용용반점', category: '중식' });
    insertMerchant(h.db, 'm-fake', { name: '초특가 아무거나', category: '기타', verified: false });
    insertMerchant(h.db, 'm-off', { name: '쉬는 가게', active: false });
    insertMenu(h.db, 'x-dwaeji', 'm-gukbap', 9_000n, { name: '돼지국밥', tags: ['국물'] });
    insertMenu(h.db, 'x-anything', 'm-fake', 1_000n);
    insertMenu(h.db, 'x-off', 'm-off', 5_000n);
    const moduleRef = await Test.createTestingModule({ imports: [MerchantsModule] })
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

  it('answers 401 without a session, for the list and for one merchant', async () => {
    expect((await http().get('/api/merchants')).status).toBe(401);
    expect((await http().get('/api/merchants/m-gukbap')).status).toBe(401);
  });

  it('lists verified, active merchants only, valid against the shared schema', async () => {
    const res = await http().get('/api/merchants').set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(200);
    const body = zMerchantList.parse(res.body);
    expect(body.merchants.map((m) => m.id)).toEqual(['m-gukbap', 'm-jjajang']);
  });

  it('filters by category and takes verified=true', async () => {
    const res = await http()
      .get('/api/merchants?category=%EC%A4%91%EC%8B%9D&verified=true')
      .set('Cookie', `sid=${tokens.u1}`);
    expect(zMerchantList.parse(res.body).merchants.map((m) => m.id)).toEqual(['m-jjajang']);
  });

  it('never lists unverified merchants: verified=false is 400, not a back door', async () => {
    const res = await http().get('/api/merchants?verified=false').set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    const cat = await http()
      .get('/api/merchants?category=%EA%B8%B0%ED%83%80')
      .set('Cookie', `sid=${tokens.u1}`);
    expect(zMerchantList.parse(cat.body).merchants).toEqual([]);
  });

  it('rejects unknown query keys such as another user id', async () => {
    const res = await http().get('/api/merchants?userId=u2').set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(400);
  });

  it('gives one merchant with aokrw menu prices', async () => {
    const res = await http()
      .get('/api/merchants/m-gukbap')
      .set('Authorization', `Bearer ${tokens.u2}`);
    expect(res.status).toBe(200);
    const body = zMerchantDetail.parse(res.body);
    expect(body.merchant.name).toBe('마루국밥 본점');
    expect(body.menus).toEqual([
      {
        id: 'x-dwaeji',
        name: '돼지국밥',
        price: '9000000000000000000000',
        tags: ['국물'],
        description: '',
        available: true,
      },
    ]);
  });

  it('is the same for every user: merchants hold nothing per user', async () => {
    const a = await http().get('/api/merchants/m-gukbap').set('Cookie', `sid=${tokens.u1}`);
    const b = await http()
      .get('/api/merchants/m-gukbap')
      .set('Authorization', `Bearer ${tokens.u2}`);
    expect(a.body).toEqual(b.body);
  });

  it.each([
    ['an inactive merchant', 'm-off'],
    ['an unverified merchant', 'm-fake'],
    ['an unknown id', 'nope'],
  ])('answers 404 for %s, without its menus', async (_name, id) => {
    const res = await http().get(`/api/merchants/${id}`).set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('x-');
  });

  it('answers 400 for an id over 64 characters', async () => {
    const res = await http()
      .get(`/api/merchants/${'a'.repeat(65)}`)
      .set('Cookie', `sid=${tokens.u1}`);
    expect(res.status).toBe(400);
  });
});
