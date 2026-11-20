import 'reflect-metadata';
import type { Server } from 'node:http';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type ChatEvent, type RecommendationCard, zChatEvent } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { ScriptedProvider } from './harness/scripted-provider.js';
import { LLM_PROVIDER } from './llm-provider.js';
import { LlmModule } from './llm.module.js';
import type { ToolHandlers } from './runtime.js';
import { LlmToolHandlers } from './tools/handlers.js';
import { ToolReply } from './tools/tool-reply.js';

const W9000 = '9000000000000000000000'; // 9,000원 in aokrw, by hand

const open: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const o of open.splice(0)) await o.close();
});

/** Handlers that answer every tool with `reply` (to force a bad card). */
function stubHandlers(reply: unknown): { build: () => ToolHandlers } {
  const answer = () => Promise.resolve(reply);
  return {
    build: () => ({
      get_budget: answer,
      get_order_history: answer,
      get_context: answer,
      recommend_merchants: answer,
      get_menu: answer,
      place_order: answer,
      request_owner_approval: answer,
      propose_limit_change: answer,
    }),
  };
}

async function setup(provider: ScriptedProvider, handlers?: { build: () => ToolHandlers }) {
  const h: DbHandle = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  insertMerchant(h.db, 'm-gukbap', { name: '마루국밥 본점', tags: ['국물'] });
  insertMenu(h.db, 'x-dwaeji', 'm-gukbap', 9_000n, { name: '돼지국밥', tags: ['국물'] });
  let builder = Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
    .overrideProvider(LLM_PROVIDER)
    .useValue(provider);
  if (handlers !== undefined)
    builder = builder.overrideProvider(LlmToolHandlers).useValue(handlers);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({
    close: async () => {
      await app.close();
      h.close();
    },
  });
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  return (text: string, clientMessageId: string) =>
    request(app.getHttpServer() as Server)
      .post('/api/chat/messages')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send({ text, clientMessageId });
}

function events(text: string): ChatEvent[] {
  return text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => zChatEvent.parse(JSON.parse(f.slice('data: '.length))));
}

const recommendTurns = () =>
  new ScriptedProvider([
    { blocks: [{ text: '찾아볼게용.' }, { tool: 'recommend_merchants', input: {} }] },
    { blocks: [{ text: '돼지국밥 어때용?' }] },
  ]);

const card = (id: string): RecommendationCard => ({
  id,
  merchantId: 'm',
  menuId: id,
  store: '가게',
  etaMin: 3,
  menu: '메뉴',
  price: W9000,
  needsApproval: false,
});

describe('recommendation cards in the chat stream', () => {
  it('sends recommend_merchants results as a recommendations event in aokrw', async () => {
    const post = await setup(recommendTurns());
    const list = events((await post('점심 추천해 줘', 'c1')).text);
    expect(list.map((e) => e.type)).toEqual([
      'token',
      'tool_status',
      'recommendations',
      'tool_status',
      'token',
      'done',
    ]);
    expect(list[2]).toEqual({
      type: 'recommendations',
      items: [
        {
          id: 'x-dwaeji',
          merchantId: 'm-gukbap',
          menuId: 'x-dwaeji',
          store: '마루국밥 본점',
          etaMin: 3,
          menu: '돼지국밥',
          price: W9000,
          needsApproval: false,
        },
      ],
    });
  });

  it('keeps the card in the stored turn, so a resend replays it', async () => {
    const post = await setup(recommendTurns());
    const first = events((await post('점심 추천해 줘', 'c1')).text);
    const again = events((await post('점심 추천해 줘', 'c1')).text);
    expect(again.filter((e) => e.type === 'recommendations')).toEqual(
      first.filter((e) => e.type === 'recommendations'),
    );
  });

  it('drops a card that fails zChatEvent (4 items), logs it, and finishes the turn', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const four = new ToolReply(
      { candidates: [] },
      { type: 'recommendations', items: ['a', 'b', 'c', 'd'].map(card) },
    );
    const post = await setup(recommendTurns(), stubHandlers(four));
    const res = await post('점심 추천해 줘', 'c1');
    const list = events(res.text);
    expect(list.map((e) => e.type)).toEqual([
      'token',
      'tool_status',
      'tool_status',
      'token',
      'done',
    ]);
    expect(res.text).not.toContain(W9000);
    expect(logged).toHaveBeenCalledWith(
      'dropped a recommendations card from recommend_merchants: invalid at items',
    );
  });

  it('drops a card from a tool that does not own that card type', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const stray = new ToolReply({}, { type: 'recommendations', items: [card('a')] });
    const provider = new ScriptedProvider([
      { blocks: [{ tool: 'get_menu', input: { merchantId: 'm-gukbap' } }] },
      { blocks: [{ text: '끝' }] },
    ]);
    const post = await setup(provider, stubHandlers(stray));
    const list = events((await post('메뉴 보여 줘', 'c1')).text);
    expect(list.some((e) => e.type === 'recommendations')).toBe(false);
    expect(logged).toHaveBeenCalledWith(
      'dropped a recommendations card from get_menu: not its card type',
    );
  });

  it('never gives the model the aokrw from the card', async () => {
    const provider = recommendTurns();
    const post = await setup(provider);
    await post('점심 추천해 줘', 'c1');
    const sent = JSON.stringify(provider.requests.map((r) => r.messages));
    expect(sent).toContain('9,000원');
    expect(sent).not.toContain(W9000);
  });
});
