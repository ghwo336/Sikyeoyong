import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, zBudgetView, zChatEvent } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../../../config/config.module.js';
import { loadConfig } from '../../../config/env.js';
import { type DbHandle, openDb } from '../../../db/client.js';
import { DB } from '../../../db/db.module.js';
import { runMigrations } from '../../../db/migrate.js';
import { agents, users } from '../../../db/schema/index.js';
import { ScriptedProvider } from '../harness/scripted-provider.js';
import { LlmModule } from '../llm.module.js';
import { AgentRuntime } from '../runtime.js';
import { budgetForModel, LlmToolHandlers } from './handlers.js';
import { ToolReply } from './tool-reply.js';

const NOW = Date.parse('2026-12-10T03:28:00.000Z'); // 12:28 KST
const s = (won: bigint) => okrwToAokrw(won).toString();
const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

async function setupWithDb(env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  for (const [id, dong, budget] of [
    ['u1', '역삼동', 300_000n],
    ['u2', null, 200_000n],
  ] as const) {
    h.db
      .insert(users)
      .values({
        id,
        nickname: id,
        addressDong: dong,
        myPeriodicLimitAokrw: s(budget),
        createdAt: 1,
      })
      .run();
    h.db
      .insert(agents)
      .values({
        id: `a-${id}`,
        userId: id,
        dragonName: '용이',
        dragonSpecies: 'water',
        paymentPath: 'B',
        perOrderLimitAokrw: '10000000000000000000000',
        createdAt: 1,
      })
      .run();
  }
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ WEATHER_STATIC: '비', ...env }) : undefined,
    )
    .compile();
  return { handlers: moduleRef.get(LlmToolHandlers).build(() => NOW), h };
}

async function setup(env: Record<string, string> = {}) {
  return (await setupWithDb(env)).handlers;
}

const results = (provider: ScriptedProvider, turn: number) =>
  provider.resultsAfter(turn).map((r) => ({
    isError: r.is_error ?? false,
    content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content),
  }));

describe('LlmToolHandlers (agent-runtime.md)', () => {
  it('get_budget gives the model display amounts, never raw aokrw', async () => {
    const handlers = await setup();
    const out = await handlers.get_budget({ userId: 'u2' }, {});
    expect(out).toEqual({
      perOrderLimit: '10,000원',
      myThirtyDayLimit: '200,000원',
      thirtyDayUsed: '0원',
      nagLevel: 'none',
      thirtyDayCap: '500,000원',
      thirtyDayResetsAt: null,
      frozen: false,
      ranges: {
        perOrderLimit: { min: '5,000원', max: '50,000원', step: '5,000원' },
        myThirtyDayLimit: { min: '50,000원', max: '500,000원', step: '50,000원' },
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/\d{19}/);
  });

  it('shows the 30-day reset time in KST, not unix seconds', () => {
    const range = { min: '0', max: '0', step: '1' };
    const view = zBudgetView.parse({
      myPeriodicLimit: '0',
      nagLevel: 'none',
      chainCap: '0',
      chainUsed: '0',
      chainResetAtSec: 1_767_225_600,
      perOrderLimit: '0',
      frozen: false,
      limitRanges: { perOrder: range, myPeriodic: range },
    });
    // 1767225600 = 2026-01-01T00:00:00Z = 2026-01-01 09:00 KST
    expect(budgetForModel(view).thirtyDayResetsAt).toBe('2026. 1. 1. 9시 0분');
  });

  describe('propose_limit_change (D-21, D-31): a card only, numbers from the server', () => {
    const A = (won: bigint) => okrwToAokrw(won);

    it('raising the per-order limit: before and after from the server, re-auth, the other limit as a row', async () => {
      const handlers = await setup();
      const out = await handlers.propose_limit_change(
        { userId: 'u1' },
        { field: 'perOrder', amountAokrw: A(45_000n) },
      );
      expect(out).toBeInstanceOf(ToolReply);
      const reply = out as ToolReply;
      expect(reply.forModel).toMatchObject({
        status: 'LIMIT_CARD_SHOWN',
        changed: false,
        from: '10,000원',
        to: '45,000원',
      });
      expect(reply.card).toEqual({
        type: 'limit_change_card',
        card: {
          cardId: expect.any(String) as string,
          field: 'perOrder',
          from: s(10_000n),
          to: s(45_000n),
          needsReauth: true,
          rows: [{ label: '30일에 쓸 돈', value: '300,000원 그대로' }],
        },
      });
      expect(zChatEvent.safeParse(reply.card).success).toBe(true);
      expect(JSON.stringify(reply.forModel)).not.toMatch(/\d{19}/);
    });

    it('lowering the 30-day limit needs no re-auth', async () => {
      const handlers = await setup();
      const out = (await handlers.propose_limit_change(
        { userId: 'u1' },
        { field: 'myPeriodic', amountAokrw: A(200_000n) },
      )) as ToolReply;
      expect(out.card).toMatchObject({
        card: {
          field: 'myPeriodic',
          from: s(300_000n),
          to: s(200_000n),
          needsReauth: false,
          rows: [{ label: '한 번에 쓸 돈', value: '10,000원 그대로' }],
        },
      });
    });

    it.each([
      ['perOrder', 7_000n],
      ['perOrder', 55_000n],
      ['perOrder', 0n],
      ['myPeriodic', 550_000n],
      ['myPeriodic', 75_000n],
    ] as const)('drops the card for %s %s won (out of range or off step)', async (field, won) => {
      const handlers = await setup();
      const out = await handlers.propose_limit_change(
        { userId: 'u1' },
        { field, amountAokrw: A(won) },
      );
      expect(out).not.toBeInstanceOf(ToolReply);
      expect(out).toMatchObject({ status: 'NO_CARD', reason: 'OUT_OF_RANGE' });
    });

    it('drops the card when the amount is the current one', async () => {
      const handlers = await setup();
      const out = await handlers.propose_limit_change(
        { userId: 'u1' },
        { field: 'myPeriodic', amountAokrw: A(300_000n) },
      );
      expect(out).toEqual({
        status: 'NO_CARD',
        reason: 'SAME_AS_NOW',
        field: '30일에 쓸 돈',
        now: '300,000원',
      });
    });

    it('changes nothing in the DB', async () => {
      const { handlers, h } = await setupWithDb();
      const before = h.db.select().from(agents).all();
      const usersBefore = h.db.select().from(users).all();
      await handlers.propose_limit_change(
        { userId: 'u1' },
        { field: 'perOrder', amountAokrw: A(50_000n) },
      );
      expect(h.db.select().from(agents).all()).toEqual(before);
      expect(h.db.select().from(users).all()).toEqual(usersBefore);
    });
  });

  it('get_context gives KST time, the user neighborhood and the static weather', async () => {
    const handlers = await setup();
    expect(await handlers.get_context({ userId: 'u1' }, {})).toEqual({
      nowKst: '2026. 12. 10. 12시 28분',
      dong: '역삼동',
      weather: '비',
    });
    expect(await handlers.get_context({ userId: 'u2' }, {})).toMatchObject({ dong: null });
  });

  it('get_context says weather is null, not a made-up sky, when the provider is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const handlers = await setup({ WEATHER_PROVIDER: 'openmeteo' });
    expect(await handlers.get_context({ userId: 'u1' }, {})).toMatchObject({ weather: null });
    vi.unstubAllGlobals();
  });

  it('runs through the runtime: data wrapped, unbuilt tools come back as errors, nothing is ordered', async () => {
    const handlers = await setup();
    const provider = new ScriptedProvider([
      {
        blocks: [
          { tool: 'get_budget', input: {} },
          { tool: 'get_context', input: {} },
        ],
      },
      {
        blocks: [{ tool: 'get_order_history', input: { days: 7 } }],
      },
      { blocks: [{ text: '아직 주문은 못 해용.' }] },
    ]);
    await new AgentRuntime(provider, handlers).run(
      { ctx: { userId: 'u1' }, history: [], userText: '점심 시켜 줘' },
      () => undefined,
    );
    const [budget, context] = results(provider, 1);
    expect(budget?.isError).toBe(false);
    expect(budget?.content.startsWith('<data>')).toBe(true);
    expect(budget?.content).toContain('300,000원');
    expect(budget?.content).not.toContain(s(300_000n));
    expect(context?.content).toContain('역삼동');
    const [order] = results(provider, 2);
    expect(order?.isError).toBe(true);
    expect(order?.content).toContain('INTERNAL');
  });
});
