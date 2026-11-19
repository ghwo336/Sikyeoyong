import 'reflect-metadata';
import type { Server } from 'node:http';
import { Controller, Get, type INestApplication, Module, Post, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { users } from '../../db/schema/index.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import { AuthService, type SessionUser } from '../../modules/auth/auth.service.js';
import { CurrentUser, SessionGuard } from './session.guard.js';

@Controller('probe')
@UseGuards(SessionGuard)
class ProbeController {
  @Get()
  read(@CurrentUser() user: SessionUser) {
    return { userId: user.userId };
  }

  @Post()
  write(@CurrentUser() user: SessionUser) {
    return { userId: user.userId };
  }
}

@Module({ imports: [AuthModule], controllers: [ProbeController] })
class ProbeModule {}

interface ErrorBody {
  error: { code: string };
}
const codeOf = (body: unknown) => (body as ErrorBody).error.code;

describe('SessionGuard over HTTP', () => {
  let app: INestApplication;
  let h: DbHandle;
  let token: string;
  const http = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    h = openDb(':memory:');
    runMigrations(h.db);
    h.db
      .insert(users)
      .values({ id: 'u1', nickname: '주인님', monthlyBudgetAokrw: '1', createdAt: 1 })
      .run();
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
      .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    token = moduleRef.get(AuthService).issue('u1', 'web');
  });

  afterAll(async () => {
    await app.close();
    h.close();
  });

  it('reads the user from the sid cookie', async () => {
    const res = await http().get('/api/probe').set('Cookie', `other=1; sid=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'u1' });
  });

  it('reads the user from a Bearer token (native)', async () => {
    const res = await http().post('/api/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
  });

  it('answers 401 UNAUTHENTICATED without or with a bad session', async () => {
    for (const r of [
      http().get('/api/probe'),
      http().get('/api/probe').set('Cookie', 'sid=nope'),
      http().get('/api/probe').set('Authorization', 'Bearer nope'),
    ]) {
      const res = await r;
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe('UNAUTHENTICATED');
    }
  });

  it('refuses a cookie write without X-Requested-With (CSRF)', async () => {
    const bare = await http().post('/api/probe').set('Cookie', `sid=${token}`);
    expect(bare.status).toBe(403);
    expect(codeOf(bare.body)).toBe('FORBIDDEN');
    const ok = await http()
      .post('/api/probe')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch');
    expect(ok.status).toBe(201);
  });

  it('ignores a user id sent in the body', async () => {
    const res = await http()
      .post('/api/probe')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 'someone-else' });
    expect(res.body).toEqual({ userId: 'u1' });
  });
});
