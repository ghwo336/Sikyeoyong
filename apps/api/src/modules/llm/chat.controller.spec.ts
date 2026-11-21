import 'reflect-metadata';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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
import { ChatService, REFUSAL_LINE } from './chat.service.js';
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
    h.db
      .insert(users)
      .values({ id, nickname: id, myPeriodicLimitAokrw: budget, createdAt: 1 })
      .run();
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

/** A finished turn: the user row and the dragon reply that answers it. */
/** Seeded history sits in one recent session, as if the meal were going on (D-34). */
const SESSION = 'session-1';
const BASE = Date.now() - 10 * 60_000;

function addTurn(
  h: DbHandle,
  userId: string,
  clientId: string,
  asked: string,
  said: string,
  at: number,
) {
  const id = `${userId}-${clientId}`;
  h.db
    .insert(chatMessages)
    .values({
      id,
      userId,
      role: 'user',
      contentJson: JSON.stringify({ text: asked }),
      clientMessageId: clientId,
      sessionId: SESSION,
      createdAt: BASE + at,
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
          { type: 'token', text: said },
          { type: 'done', messageId: `${id}-r` },
        ],
      }),
      replyToId: id,
      sessionId: SESSION,
      createdAt: BASE + at + 1,
    })
    .run();
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

  it('limits a user to 20 messages a minute (429), without calling the model', async () => {
    const provider = scripted(Array.from({ length: 20 }, () => ({ blocks: [{ text: '네' }] })));
    const { post } = await setup(provider);
    for (let i = 0; i < 20; i += 1) {
      expect(
        (await post({ text: `${String(i)}번`, clientMessageId: `r${String(i)}` })).status,
      ).toBe(200);
    }
    const over = await post({ text: '21번', clientMessageId: 'r20' });
    expect(over.status).toBe(429);
    expect(over.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: '잠시 후 다시 시도해 주세요',
        dragonLine: '숨 좀 돌리고 올게용',
      },
    });
    expect(provider.requests).toHaveLength(20);
    // A replay of a finished turn costs nothing, so it still answers.
    expect((await post({ text: '0번', clientMessageId: 'r0' })).status).toBe(200);
  });

  it("refuses a second message while the user's turn is running, then allows the next", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const slow: LlmProvider = {
      turn: async () => {
        await gate;
        return {
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'scripted',
          content: [{ type: 'text', text: '네', citations: null }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        } as never;
      },
    };
    const { app } = await setup(slow);
    const chat = app.get(ChatService);
    const first = chat.begin('u1', { text: '점심', clientMessageId: 'p1' })(() => undefined);
    expect(() => chat.begin('u1', { text: '점심', clientMessageId: 'p2' })).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
    // Another user is not held up.
    expect(() => chat.begin('u2', { text: '점심', clientMessageId: 'p3' })).not.toThrow();
    release();
    await first;
    expect(() => chat.begin('u1', { text: '저녁', clientMessageId: 'p4' })).not.toThrow();
  });

  it('keeps nothing and stops the model when the client leaves mid-turn', async () => {
    const provider = scripted([
      { blocks: [{ text: '찾아볼게용' }, { tool: 'get_budget', input: {} }] },
      { blocks: [{ text: '끝' }] },
    ]);
    const { app, h } = await setup(provider);
    const gone = new AbortController();
    const stream = app.get(ChatService).begin('u1', { text: '예산', clientMessageId: 'leave' });
    await stream((e) => {
      if (e.type === 'token') gone.abort();
    }, gone.signal);
    expect(provider.requests).toHaveLength(1);
    expect(h.db.select().from(chatMessages).all()).toHaveLength(0);
  });

  it('finishes and stores the turn when the HTTP connection closes (real socket)', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    // A model that answers only after the client has left, so the test does not depend on timing.
    const slow: LlmProvider = {
      turn: async (_req, onText) => {
        onText('음.');
        await gate;
        onText(' 피자 좋아용');
        return {
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'scripted',
          content: [{ type: 'text', text: '음. 피자 좋아용', citations: null }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        } as never;
      },
    };
    const { app, token, h } = await setup(slow);
    await app.listen(0);
    const port = (app.getHttpServer() as Server).address() as AddressInfo;
    await new Promise<void>((done) => {
      const req = httpRequest(
        {
          port: port.port,
          path: '/api/chat/messages',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `sid=${token}`,
            'x-requested-with': 'fetch',
          },
        },
        (res) => {
          res.once('data', () => {
            req.destroy(); // the user closed the app after the first word
            done();
          });
        },
      );
      req.end(JSON.stringify({ text: '피자 시켜 줘', clientMessageId: 'sock' }));
    });
    // The question is saved the moment it is accepted, even while the answer is still running.
    expect(
      h.db
        .select()
        .from(chatMessages)
        .all()
        .map((r) => r.role),
    ).toEqual(['user']);
    release();
    for (let i = 0; i < 200 && h.db.select().from(chatMessages).all().length < 2; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
    const rows = h.db.select().from(chatMessages).all();
    expect(rows.map((r) => r.role)).toEqual(['user', 'assistant']);
    expect(rows[1]?.contentJson).toContain('피자 좋아용');
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

    it('keeps each user history apart, even for complete turns', async () => {
      const provider = scripted([{ blocks: [{ text: 'u1에게' }] }]);
      const { post, h } = await setup(provider);
      addTurn(h, 'u2', 'o', '남의 말', '남의 답', 5);
      await post({ text: 'u1 말', clientMessageId: 'a' });
      const sent = JSON.stringify(provider.requests.at(-1)?.messages);
      expect(sent).not.toContain('남의 말');
      expect(sent).not.toContain('남의 답');
    });

    it('scopes clientMessageId to the user: another user may reuse it', async () => {
      const provider = scripted([{ blocks: [{ text: 'u2의 새 답' }] }]);
      const { post, h } = await setup(provider, {}, 'u2');
      addTurn(h, 'u1', 'same', '점심', 'u1만 볼 답', 5);
      const sameWords = await post({ text: '점심', clientMessageId: 'same' });
      expect(sameWords.status).toBe(200);
      expect(sameWords.text).not.toContain('u1만 볼 답');
      expect(provider.requests).toHaveLength(1);
    });

    it('lets another user use the id with different words (no 409)', async () => {
      const provider = scripted([{ blocks: [{ text: '네' }] }]);
      const { post, h } = await setup(provider, {}, 'u2');
      addTurn(h, 'u1', 'same', '점심', 'u1 답', 5);
      expect((await post({ text: '저녁', clientMessageId: 'same' })).status).toBe(200);
    });

    it('sends exactly the last 20 turns, oldest dropped', async () => {
      const provider = scripted([{ blocks: [{ text: '지금 답' }] }]);
      const { post, h } = await setup(provider);
      for (let i = 1; i <= 21; i += 1)
        addTurn(h, 'u1', `t${String(i)}`, `질문${String(i)}`, `답${String(i)}`, i * 10);
      await post({ text: '지금', clientMessageId: 'now' });
      const sent = provider.requests.at(-1)?.messages ?? [];
      const expected = [];
      for (let i = 2; i <= 21; i += 1) {
        expected.push({ role: 'user', content: `질문${String(i)}` });
        expected.push({ role: 'assistant', content: `답${String(i)}` });
      }
      expected.push({ role: 'user', content: '지금' });
      expect(sent).toEqual(expected);
    });

    it('skips unreadable stored turns instead of locking the user out', async () => {
      const provider = scripted([{ blocks: [{ text: '괜찮아용' }] }]);
      const { post, h } = await setup(provider);
      addTurn(h, 'u1', 'ok', '읽히는 말', '읽히는 답', 10);
      h.db
        .insert(chatMessages)
        .values({
          id: 'bu',
          userId: 'u1',
          role: 'user',
          contentJson: '{oops',
          clientMessageId: 'bad1',
          sessionId: SESSION,
          createdAt: BASE + 20,
        })
        .run();
      h.db
        .insert(chatMessages)
        .values({
          id: 'ba',
          userId: 'u1',
          role: 'assistant',
          contentJson: '{"events":[{"type":"token","text":"옛 답","extra":1},{"type":"card_v0"}]}',
          replyToId: 'bu',
          sessionId: SESSION,
          createdAt: BASE + 21,
        })
        .run();
      const res = await post({ text: '다음', clientMessageId: 'next' });
      expect(res.status).toBe(200);
      expect(provider.requests.at(-1)?.messages).toEqual([
        { role: 'user', content: '읽히는 말' },
        { role: 'assistant', content: '읽히는 답' },
        { role: 'user', content: '다음' },
      ]);
    });

    it('reads only the words of an older-schema answer, never its other events', async () => {
      const provider = scripted([{ blocks: [{ text: '네' }] }]);
      const { post, h } = await setup(provider);
      h.db
        .insert(chatMessages)
        .values({
          id: 'ou',
          userId: 'u1',
          role: 'user',
          contentJson: '{"text":"옛 질문"}',
          clientMessageId: 'old',
          sessionId: SESSION,
          createdAt: BASE + 10,
        })
        .run();
      h.db
        .insert(chatMessages)
        .values({
          id: 'oa',
          userId: 'u1',
          role: 'assistant',
          contentJson:
            '{"events":[{"type":"token","text":"옛 답","extra":1},{"type":"card_v0","secret":"카드 속 글"}]}',
          replyToId: 'ou',
          sessionId: SESSION,
          createdAt: BASE + 11,
        })
        .run();
      await post({ text: '지금', clientMessageId: 'now' });
      expect(provider.requests.at(-1)?.messages).toEqual([
        { role: 'user', content: '옛 질문' },
        { role: 'assistant', content: '옛 답' },
        { role: 'user', content: '지금' },
      ]);
    });

    it('answers 409 to a resend whose stored answer cannot be replayed; a new id still works', async () => {
      const provider = scripted([{ blocks: [{ text: '새 답' }] }]);
      const { post, h } = await setup(provider);
      h.db
        .insert(chatMessages)
        .values({
          id: 'xu',
          userId: 'u1',
          role: 'user',
          contentJson: '{"text":"점심"}',
          clientMessageId: 'x',
          sessionId: SESSION,
          createdAt: BASE + 10,
        })
        .run();
      h.db
        .insert(chatMessages)
        .values({
          id: 'xa',
          userId: 'u1',
          role: 'assistant',
          contentJson: '{oops',
          replyToId: 'xu',
          sessionId: SESSION,
          createdAt: BASE + 11,
        })
        .run();
      expect((await post({ text: '점심', clientMessageId: 'x' })).status).toBe(409);
      expect(provider.requests).toHaveLength(0);
      expect((await post({ text: '점심', clientMessageId: 'y' })).status).toBe(200);
      expect(provider.requests).toHaveLength(1);
    });

    it('finishes the stream when storing the answer fails (logged, not thrown)', async () => {
      const provider = scripted([{ blocks: [{ text: '답' }] }, { blocks: [{ text: '답2' }] }]);
      const { post, h, app } = await setup(provider);
      h.sqlite.exec(
        "CREATE TRIGGER no_answers BEFORE INSERT ON chat_messages WHEN NEW.role = 'assistant' BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
      );
      const res = await post({ text: '점심', clientMessageId: 's1' });
      expect(res.status).toBe(200);
      expect(events(res.text).at(-1)?.type).toBe('done');
      const stream = app.get(ChatService).begin('u1', { text: '저녁', clientMessageId: 's2' });
      await expect(stream(() => undefined)).resolves.toBeUndefined();
    });

    it('gives a failed turn a done id that names no stored row, even if cleanup fails', async () => {
      const { post, h } = await setup(null); // every turn fails
      h.sqlite.exec(
        "CREATE TRIGGER keep_rows BEFORE DELETE ON chat_messages BEGIN SELECT RAISE(ABORT, 'locked'); END;",
      );
      const res = await post({ text: '점심', clientMessageId: 'f1' });
      expect(res.status).toBe(200);
      const done = events(res.text).at(-1);
      const ids = h.db
        .select()
        .from(chatMessages)
        .all()
        .map((r) => r.id);
      expect(ids).toHaveLength(1);
      expect(done?.type === 'done' && ids.includes(done.messageId)).toBe(false);
    });
  });
});
