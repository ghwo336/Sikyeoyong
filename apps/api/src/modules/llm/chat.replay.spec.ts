import 'reflect-metadata';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { type ChatEvent, zChatEvent } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { orders } from '../../db/schema/index.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { LlmModule } from './llm.module.js';

const open: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) await o.close();
});

async function setup() {
  const h: DbHandle = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1', { dong: '역삼동' });
  insertMerchant(h.db, 'm-gukbap', { name: '마루국밥 본점', tags: ['국물'] });
  insertMenu(h.db, 'x-dwaeji', 'm-gukbap', 9_000n, { name: '돼지국밥', tags: ['국물'] });
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ LLM_MODE: 'replay' }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({
    close: async () => {
      await app.close();
      h.close();
    },
  });
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const post = (text: string, id: string) =>
    request(app.getHttpServer() as Server)
      .post('/api/chat/messages')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send({ text, clientMessageId: id });
  return { h, post };
}

const events = (text: string): ChatEvent[] =>
  text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => zChatEvent.parse(JSON.parse(f.slice('data: '.length))));

describe('LLM_MODE=replay through the real chat stream (D-26)', () => {
  it('food words: the real recommend tool runs, real cards come back, then the fixed line', async () => {
    const { post } = await setup();
    const list = events((await post('점심 시켜 줘', 'c1')).text);
    const cards = list.find((e) => e.type === 'recommendations');
    expect(cards?.type === 'recommendations' && cards.items.map((c) => c.menuId)).toEqual([
      'x-dwaeji',
    ]);
    const words = list.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('');
    expect(words).toBe('골라 봤어용. 마음에 드는 걸 눌러 주세용.');
    expect(list.at(-1)?.type).toBe('done');
  });

  it('other words: one line, no tool, and it never orders', async () => {
    const { h, post } = await setup();
    const list = events((await post('오늘 날씨 어때?', 'c1')).text);
    expect(list.map((e) => e.type)).toEqual(['token', 'done']);
    expect(h.db.select().from(orders).all()).toHaveLength(0);
  });

  it('budget words: the real get_budget runs, then the fixed line', async () => {
    const { post } = await setup();
    const list = events((await post('이번 달 얼마 남았어?', 'c1')).text);
    expect(
      list.some((e) => e.type === 'tool_status' && e.tool === 'get_budget' && e.state === 'done'),
    ).toBe(true);
    const words = list.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('');
    expect(words).toBe('이번 달 쓴 돈은 위 막대에 있어용. 아껴 볼게용.');
  });
});
