import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
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
import { agents, chatMessages, users } from '../../db/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import { REFUSAL_LINE } from './chat.service.js';
import { ScriptedProvider, type ScriptedTurn } from './harness/scripted-provider.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { LlmModule } from './llm.module.js';

const open: { app?: INestApplication; h?: DbHandle }[] = [];
afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.app?.close();
    o.h?.close();
  }
});

async function setup(
  provider: LlmProvider | null,
  env: Record<string, string> = {},
  who: 'u1' | 'u2' = 'u1',
) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  // Two users with different budgets: the model must only ever see the session user's.
  for (const [id, budget] of [
    ['u1', '100000000000000000000000'],
    ['u2', '500000000000000000000000'],
  ] as const) {
    h.db.insert(users).values({ id, nickname: id, monthlyBudgetAokrw: budget, createdAt: 1 }).run();
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
  let builder = Test.createTestingModule({ imports: [LlmModule] }).useMocker((t) =>
    t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined,
  );
  if (provider !== null) builder = builder.overrideProvider(LLM_PROVIDER).useValue(provider);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  const token = moduleRef.get(AuthService).issue(who, 'web');
  const post = (body: unknown) =>
    request(app.getHttpServer() as Server)
      .post('/api/chat/messages')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send(body as object);
  return { app, post, token, h };
}

function events(text: string): ChatEvent[] {
  return text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => zChatEvent.parse(JSON.parse(f.slice('data: '.length))));
}

const scripted = (turns: ScriptedTurn[]) => new ScriptedProvider(turns);

describe('POST /api/chat/messages (SSE)', () => {
  it('streams the dragon words, tool status and a final done, all valid ChatEvents', async () => {
    const { post } = await setup(
      scripted([
        { blocks: [{ text: '예산 볼게용.' }, { tool: 'get_budget', input: {} }] },
        { blocks: [{ text: '아직 여유 있어용.' }] },
      ]),
    );
    const res = await post({ text: '이번 달 얼마 썼어?', clientMessageId: 'c1' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const list = events(res.text);
    expect(list.map((e) => e.type)).toEqual([
      'token',
      'tool_status',
      'tool_status',
      'token',
      'done',
    ]);
    expect(
      list
        .filter((e) => e.type === 'token')
        .map((e) => e.text)
        .join(''),
    ).toBe('예산 볼게용.아직 여유 있어용.');
  });

  it('runs the tools as the session user, not anyone else', async () => {
    const provider = scripted([
      { blocks: [{ tool: 'get_budget', input: {} }] },
      { blocks: [{ text: '끝' }] },
    ]);
    const { post } = await setup(provider, {}, 'u2');
    await post({ text: '예산', clientMessageId: 'c-u2' });
    const result = provider.resultsAfter(1)[0];
    const content = typeof result?.content === 'string' ? result.content : '';
    expect(content).toContain('500,000원');
    expect(content).not.toContain('100,000원');
  });

  it('never streams tool results (budget numbers stay server-side data for the model)', async () => {
    const { post } = await setup(
      scripted([{ blocks: [{ tool: 'get_budget', input: {} }] }, { blocks: [{ text: '끝' }] }]),
    );
    const res = await post({ text: '예산', clientMessageId: 'c2' });
    expect(res.text).not.toContain('<data>');
    expect(res.text).not.toContain('personalBudget');
  });

  it('says the fallback line when the model refuses', async () => {
    const { post } = await setup(scripted([{ blocks: [{ text: '' }], stop: 'refusal' }]));
    const list = events((await post({ text: '이상한 부탁', clientMessageId: 'c3' })).text);
    expect(list.at(-2)).toEqual({ type: 'token', text: REFUSAL_LINE });
    expect(list.at(-1)?.type).toBe('done');
  });

  it('turns a failure mid-stream into the dragon line, never a stack or a key', async () => {
    // No LLM_MODEL or key in this config: the real factory answers INTERNAL on the turn.
    const { post } = await setup(null);
    const res = await post({ text: '점심 시켜 줘', clientMessageId: 'c4' });
    expect(res.status).toBe(200);
    const list = events(res.text);
    expect(list).toEqual([
      { type: 'token', text: '앗, 뭔가 꼬였어용' },
      { type: 'done', messageId: expect.any(String) as string },
    ]);
    expect(res.text).not.toMatch(/ANTHROPIC_API_KEY|LLM_MODEL|stack|Error:/);
  });

  it('checks the session, the CSRF header and the body before any model call', async () => {
    const provider = scripted([]);
    const { app, post, token } = await setup(provider);
    const http = request(app.getHttpServer() as Server);
    expect(
      (await http.post('/api/chat/messages').send({ text: 'a', clientMessageId: 'c' })).status,
    ).toBe(401);
    expect(
      (
        await http
          .post('/api/chat/messages')
          .set('Cookie', `sid=${token}`)
          .send({ text: 'a', clientMessageId: 'c' })
      ).status,
    ).toBe(403);
    expect((await post({ text: '   ', clientMessageId: 'c5' })).status).toBe(400);
    expect((await post({ text: 'a', clientMessageId: 'c6', userId: 'u2' })).status).toBe(400);
    expect(provider.requests).toHaveLength(0);
  });

  describe('clientMessageId and history', () => {
    it('answers a resend of a finished turn from storage, without calling the model again', async () => {
      const provider = scripted([{ blocks: [{ text: '국밥 어때용?' }] }]);
      const { post } = await setup(provider);
      const first = await post({ text: '점심 뭐 먹지', clientMessageId: 'same' });
      const again = await post({ text: '점심 뭐 먹지', clientMessageId: 'same' });
      expect(again.status).toBe(200);
      expect(events(again.text)).toEqual(events(first.text));
      expect(provider.requests).toHaveLength(1);
    });

    it('refuses the same id with different words (409 CONFLICT)', async () => {
      const provider = scripted([{ blocks: [{ text: '네' }] }]);
      const { post } = await setup(provider);
      await post({ text: '점심', clientMessageId: 'id-1' });
      const res = await post({ text: '저녁', clientMessageId: 'id-1' });
      expect(res.status).toBe(409);
      expect(provider.requests).toHaveLength(1);
    });

    it('refuses a resend while the first is still unanswered', async () => {
      const provider = scripted([]);
      const { post, h } = await setup(provider);
      h.db
        .insert(chatMessages)
        .values({
          id: 'm-run',
          userId: 'u1',
          role: 'user',
          contentJson: '{"text":"점심"}',
          clientMessageId: 'id-run',
          createdAt: 1,
        })
        .run();
      expect((await post({ text: '점심', clientMessageId: 'id-run' })).status).toBe(409);
      expect(provider.requests).toHaveLength(0);
    });

    it('keeps nothing from a failed turn, so the same message can be sent again', async () => {
      const { post, h } = await setup(null); // no model configured: every turn fails
      await post({ text: '점심', clientMessageId: 'retry' });
      expect(h.db.select().from(chatMessages).all()).toHaveLength(0);
      const again = await post({ text: '점심', clientMessageId: 'retry' });
      expect(again.status).toBe(200);
    });

    it('gives the model earlier words only, never earlier tool results', async () => {
      const provider = scripted([
        { blocks: [{ tool: 'get_budget', input: {} }] },
        { blocks: [{ text: '이번 달 여유 있어용.' }] },
        { blocks: [{ text: '국밥 좋아용.' }] },
      ]);
      const { post } = await setup(provider);
      await post({ text: '예산 알려 줘', clientMessageId: 'h1' });
      await post({ text: '그럼 국밥?', clientMessageId: 'h2' });
      const sentToModel = provider.requests.at(-1)?.messages ?? [];
      expect(sentToModel).toEqual([
        { role: 'user', content: '예산 알려 줘' },
        { role: 'assistant', content: '이번 달 여유 있어용.' },
        { role: 'user', content: '그럼 국밥?' },
      ]);
      expect(JSON.stringify(sentToModel)).not.toContain('<data>');
    });

    it('keeps each user history apart', async () => {
      const provider = scripted([
        { blocks: [{ text: 'u1에게' }] },
        { blocks: [{ text: 'u2에게' }] },
      ]);
      const { post, h } = await setup(provider);
      await post({ text: 'u1 말', clientMessageId: 'a' });
      h.db
        .insert(chatMessages)
        .values({
          id: 'other',
          userId: 'u2',
          role: 'user',
          contentJson: '{"text":"남의 말"}',
          clientMessageId: 'b',
          createdAt: 2,
        })
        .run();
      await post({ text: '두 번째', clientMessageId: 'c' });
      expect(JSON.stringify(provider.requests.at(-1)?.messages)).not.toContain('남의 말');
    });
  });
});
