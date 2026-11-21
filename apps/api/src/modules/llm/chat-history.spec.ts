import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type ChatHistory, zChatHistory } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
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
import { ChatHistoryService, HISTORY_PAGE_ROWS } from './chat-history.service.js';
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
    h.db.insert(users).values({ id, nickname: id, myPeriodicLimitAokrw: '1', createdAt: 1 }).run();
    h.db
      .insert(agents)
      .values({
        id: `a-${id}`,
        userId: id,
        dragonName: '용이',
        dragonSpecies: 'forest',
        paymentPath: 'B',
        perOrderLimitAokrw: '10000000000000000000000',
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
  const history = moduleRef.get(ChatHistoryService);
  return { h, get, anon, history };
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

  it('names each message session (D-34) and leaves it out on rows from before sessions', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 1);
    h.db
      .update(chatMessages)
      .set({ sessionId: 's-old' })
      .where(eq(chatMessages.id, 'u1-000'))
      .run();
    const page = zChatHistory.parse((await get('u1')).body);
    expect(page.messages.map((m) => m.sessionId)).toEqual(['s-old', undefined]);
  });

  it('gives each message the time it was stored', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u1', 1);
    h.db
      .update(chatMessages)
      .set({ createdAt: 1_700_000_123_456 })
      .where(eq(chatMessages.id, 'u1-000'))
      .run();
    const page = zChatHistory.parse((await get('u1')).body);
    const stamps = page.messages.map((m) => m.createdAt);
    expect(page.messages.find((m) => m.id === 'u1-000')?.createdAt).toBe(1_700_000_123_456);
    expect(stamps.every((t) => typeof t === 'number')).toBe(true);
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

  it('keeps other users out of later pages too', async () => {
    const { h, get } = await setup();
    seedTurns(h, 'u2', 5, 0); // u2 rows are older than all of u1's
    seedTurns(h, 'u1', 20, 1000); // 40 rows: two pages
    const first = zChatHistory.parse((await get('u1')).body);
    const second = zChatHistory.parse((await get('u1', `?cursor=${first.nextCursor ?? ''}`)).body);
    const ids = [...first.messages, ...second.messages].map((m) => m.id);
    expect(ids.every((id) => id.startsWith('u1-'))).toBe(true);
    expect(ids).toHaveLength(40);
    expect(second.nextCursor).toBeNull();
  });

  it('pages through rows that share a timestamp without gaps or repeats', async () => {
    const { h, get } = await setup();
    // 61 user rows, 7 per millisecond, so page edges fall inside groups of equal created_at.
    const inserted: string[] = [];
    // Inserted newest first, so storage order differs from id order and only ORDER BY id keeps it.
    for (let i = 60; i >= 0; i -= 1) {
      const id = `u1-t${String(i).padStart(3, '0')}`;
      inserted.unshift(id);
      h.db
        .insert(chatMessages)
        .values({
          id,
          userId: 'u1',
          role: 'user',
          contentJson: JSON.stringify({ text: `m${String(i)}` }),
          clientMessageId: id,
          createdAt: 5000 + Math.floor(i / 7),
        })
        .run();
    }
    const seen: string[] = [];
    let cursor: string | null = '';
    let pages = 0;
    while (cursor !== null) {
      const page = zChatHistory.parse(
        (await get('u1', cursor === '' ? '' : `?cursor=${cursor}`)).body,
      );
      seen.unshift(...page.messages.map((m) => m.id));
      cursor = page.nextCursor;
      pages += 1;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(inserted);
  });

  it('stamps the page with the first message it shows, skipping unreadable rows', async () => {
    const { h, history } = await setup();
    h.db
      .insert(chatMessages)
      .values({
        id: 'u1-bad',
        userId: 'u1',
        role: 'user',
        contentJson: '{oops',
        clientMessageId: 'b',
        createdAt: 900,
      })
      .run();
    seedTurns(h, 'u1', 1, 1000); // user row at 1000, dragon row at 1001
    const page = history.page('u1', undefined, 9_999);
    expect(page.messages.map((m) => m.id)).toEqual(['u1-000', 'u1-000-r']);
    expect(page.startedAt).toBe(1000);
  });

  it('stamps an empty page with now', async () => {
    const { history } = await setup();
    expect(history.page('u2', undefined, 1_767_000_000_000)).toEqual({
      startedAt: 1_767_000_000_000,
      messages: [],
      nextCursor: null,
    });
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
