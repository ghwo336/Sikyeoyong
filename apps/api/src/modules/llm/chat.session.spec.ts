import 'reflect-metadata';
import type Anthropic from '@anthropic-ai/sdk';
import { Test } from '@nestjs/testing';
import { CHAT_SESSION_IDLE_MS } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { chatMessages, orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { ChatService } from './chat.service.js';
import { LLM_PROVIDER, type LlmProvider, type LlmTurnRequest } from './llm-provider.js';
import { LlmModule } from './llm.module.js';

/*
 * D-34: a new conversation per meal; the dragon sees only the current one. Real use: it said
 * "승인 요청은 진행 중이라 기다리고 있는 중이용" long after the meal was over.
 */
const T0 = Date.parse('2026-12-10T12:00:00+09:00');
const MIN = 60_000;

const handles: DbHandle[] = [];
afterEach(() => {
  for (const h of handles.splice(0)) h.close();
});

async function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1');
  insertMerchant(h.db, 'm1');
  const seen: LlmTurnRequest[] = [];
  const provider: LlmProvider = {
    turn: (request, onText) => {
      seen.push({ ...request, messages: structuredClone(request.messages) });
      onText('네용');
      return Promise.resolve({
        id: 'x',
        type: 'message',
        role: 'assistant',
        model: 'm',
        content: [{ type: 'text', text: '네용', citations: null }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as Anthropic.Message);
    },
  };
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ LLM_MODE: 'replay' }) : undefined,
    )
    .overrideProvider(LLM_PROVIDER)
    .useValue(provider)
    .compile();
  const chat = moduleRef.get(ChatService);
  let n = 0;
  const say = async (text: string, at: number) => {
    n += 1;
    const stream = chat.begin('u1', { text, clientMessageId: `c${String(n)}` }, at);
    await stream(() => undefined);
  };
  const sessions = () =>
    h.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.role, 'user'))
      .all()
      .filter((r) => r.clientMessageId !== 'old')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => r.sessionId);
  const order = (status: 'delivered' | 'failed' | 'pending_approval', at: number) =>
    h.db
      .insert(orders)
      .values({
        id: `o${String(at)}`,
        orderRef: `0x${String(at).padStart(64, '0')}`,
        userId: 'u1',
        agentId: 'a-u1',
        merchantId: 'm1',
        amountAokrw: '1',
        itemsJson: '[]',
        status,
        createdAt: at,
        updatedAt: at,
      })
      .run();
  return { say, sessions, order, seen, h };
}

const words = (req: LlmTurnRequest | undefined) =>
  (req?.messages ?? []).flatMap((m) => (typeof m.content === 'string' ? [m.content] : []));

describe('chat sessions (D-34)', () => {
  it('keeps one session while the meal goes on and shows the model only its own turns', async () => {
    const { say, sessions, seen } = await setup();
    await say('매콤한 거', T0);
    await say('좋아 추천해', T0 + 5 * MIN);
    const ids = sessions();
    expect(ids[0]).not.toBeNull();
    expect(ids[1]).toBe(ids[0]);
    expect(words(seen[1])).toEqual(['매콤한 거', '네용', '좋아 추천해']);
  });

  it('starts a new session after the idle limit and forgets the old words', async () => {
    const { say, sessions, seen } = await setup();
    await say('국밥 줘', T0);
    await say('안녕', T0 + CHAT_SESSION_IDLE_MS + MIN);
    const ids = sessions();
    expect(ids[1]).not.toBe(ids[0]);
    expect(words(seen[1])).toEqual(['안녕']);
  });

  it('exactly at the idle limit is still the same session', async () => {
    const { say, sessions } = await setup();
    await say('a', T0);
    await say('b', T0 + CHAT_SESSION_IDLE_MS);
    expect(sessions()[1]).toBe(sessions()[0]);
  });

  it('starts a new session once the order placed in this session has arrived', async () => {
    const { say, sessions, order, seen } = await setup();
    await say('국밥 시켜 줘', T0);
    order('delivered', T0 + MIN);
    await say('고마워', T0 + 30 * MIN);
    const ids = sessions();
    expect(ids[1]).not.toBe(ids[0]);
    expect(words(seen[1])).toEqual(['고마워']);
    // The finished order belongs to the old meal: the next message stays in the new session.
    await say('치킨 줘', T0 + 31 * MIN);
    expect(sessions()[2]).toBe(ids[1]);
  });

  it('a failed order also ends the meal', async () => {
    const a = await setup();
    await a.say('시켜', T0);
    a.order('failed', T0 + MIN);
    await a.say('다시', T0 + 2 * MIN);
    expect(a.sessions()[1]).not.toBe(a.sessions()[0]);
  });

  it('an order still waiting for the owner does not end the meal', async () => {
    const b = await setup();
    await b.say('시켜', T0);
    b.order('pending_approval', T0 + MIN);
    await b.say('어떻게 됐어', T0 + 2 * MIN);
    expect(b.sessions()[1]).toBe(b.sessions()[0]);
  });

  it('an old finished order from before this session does not split it', async () => {
    const { say, sessions, order } = await setup();
    order('delivered', T0 - 60 * MIN);
    await say('a', T0);
    await say('b', T0 + MIN);
    expect(sessions()[1]).toBe(sessions()[0]);
  });

  it('rows from before sessions (null) are never sent to the model', async () => {
    const { say, h, seen } = await setup();
    h.db
      .insert(chatMessages)
      .values({
        id: 'old-u',
        userId: 'u1',
        role: 'user',
        contentJson: JSON.stringify({ text: '옛 질문' }),
        clientMessageId: 'old',
        createdAt: T0 - MIN,
      })
      .run();
    await say('안녕', T0);
    expect(words(seen[0])).toEqual(['안녕']);
  });
});
