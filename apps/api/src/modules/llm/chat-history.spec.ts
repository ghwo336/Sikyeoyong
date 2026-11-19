import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type ChatHistory, zChatHistory } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, chatMessages, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { HISTORY_PAGE_ROWS } from './chat-history.service.js';
import { LlmModule } from './llm.module.js';

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

/** Adds `n` finished turns for a user: user row at t, dragon row at t+1. */
function seedTurns(h: DbHandle, userId: string, n: number, from = 1000) {
  for (let i = 0; i < n; i += 1) {
    const t = from + i * 10;
    const id = `${userId}-${String(i).padStart(3, '0')}`;
    h.db
      .insert(chatMessages)
      .values({
        id,
        userId,
        role: 'user',
        contentJson: JSON.stringify({ text: `질문${String(i)}` }),
        clientMessageId: id,
        createdAt: t,
      })
      .run();
    h.db
      .insert(chatMessages)
      .values({
        id: `${id}-r`,
        userId,
        role: 'assistant',
        contentJson: JSON.stringify({
          events: [
            { type: 'token', text: `답${String(i)}` },
            { type: 'done', messageId: `${id}-r` },
          ],
        }),
        replyToId: id,
        createdAt: t + 1,
      })
      .run();
  }
}

async function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  for (const id of ['u1', 'u2']) {
    h.db.insert(users).values({ id, nickname: id, monthlyBudgetAokrw: '1', createdAt: 1 }).run();
    h.db
      .insert(agents)
      .values({
        id: `a-${id}`,
        userId: id,
        dragonName: '용이',
        dragonSpecies: 'forest',
        paymentPath: 'B',
        createdAt: 1,
      })
      .run();
  }
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const get = (who: 'u1' | 'u2', query = '') =>
    request(app.getHttpServer() as Server)
      .get(`/api/chat/history${query}`)
      .set('Cookie', `sid=${tokens[who]}`);
  const anon = () => request(app.getHttpServer() as Server).get('/api/chat/history');
  return { h, get, anon };
}

const words = (history: ChatHistory) =>
  history.messages.map((m) =>
    m.role === 'user' ? m.text : m.events.map((e) => (e.type === 'token' ? e.text : '')).join(''),
  );

describe('GET /api/chat/history', () => {
  it('answers 401 without a session', async () => {
    const { anon } = await setup();
    expect((await anon()).status).toBe(401);
  });

  it('returns an empty first page with no cursor', async () => {
    const { get } = await setup();
    const res = await get('u1');
    expect(res.status).toBe(200);
    const page = zChatHistory.parse(res.body);
    expect(page.messages).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it('pages from newest toward older, oldest first within a page, without gaps or repeats', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 20); // 40 rows
    const first = zChatHistory.parse((await get('u1')).body);
    expect(first.messages).toHaveLength(HISTORY_PAGE_ROWS);
    expect(words(first).at(-1)).toBe('답19');
    expect(words(first)[0]).toBe('질문5'); // rows 10..39 of 40
    expect(first.nextCursor).toBe('u1-005');
    expect(first.startedAt).toBe(1050);
    const second = zChatHistory.parse((await get('u1', `?cursor=${first.nextCursor ?? ''}`)).body);
    expect(words(second)).toEqual([
      '질문0',
      '답0',
      '질문1',
      '답1',
      '질문2',
      '답2',
      '질문3',
      '답3',
      '질문4',
      '답4',
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it('shows only the session user messages', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 2);
    seedTurns(h, 'u2', 2, 5000);
    const page = zChatHistory.parse((await get('u2')).body);
    expect(page.messages.every((m) => m.id.startsWith('u2-'))).toBe(true);
    expect(page.messages).toHaveLength(4);
  });

  it('refuses a cursor that is not one of my messages (400), so ids do not leak', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 1);
    seedTurns(h, 'u2', 1, 5000);
    expect((await get('u2', '?cursor=u1-000')).status).toBe(400);
    expect((await get('u2', '?cursor=nope')).status).toBe(400);
    expect((await get('u2', '?cursor=u2-000&userId=u1')).status).toBe(400);
  });

  it('leaves out rows it cannot read instead of failing the page', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 1);
    h.db
      .insert(chatMessages)
      .values({ id: 'bad', userId: 'u1', role: 'assistant', contentJson: '{oops', createdAt: 2000 })
      .run();
    const res = await get('u1');
    expect(res.status).toBe(200);
    expect(words(zChatHistory.parse(res.body))).toEqual(['질문0', '답0']);
  });
});
