import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { okrwToAokrw, zBudgetView } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
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

const NOW = Date.parse('2026-12-10T03:28:00.000Z'); // 12:28 KST
const s = (won: bigint) => okrwToAokrw(won).toString();
const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

async function setup(env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  for (const [id, dong, budget] of [
    ['u1', '역삼동', 300_000n],
    ['u2', null, 200_000n],
  ] as const) {
    h.db
      .insert(users)
      .values({ id, nickname: id, addressDong: dong, monthlyBudgetAokrw: s(budget), createdAt: 1 })
      .run();
    h.db
      .insert(agents)
      .values({
        id: `a-${id}`,
        userId: id,
        dragonName: '용이',
        dragonSpecies: 'water',
        paymentPath: 'B',
        createdAt: 1,
      })
      .run();
  }
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .compile();
  return moduleRef.get(LlmToolHandlers).build(() => NOW);
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
    expect(out).toMatchObject({
      month: '2026-12',
      personalBudget: '200,000원',
      personalSpent: '0원',
      thirtyDayCap: '500,000원',
      thirtyDayUsed: '0원',
      thirtyDayResetsAt: null,
      level: 1,
      perOrderLimit: '10,000원',
      budgetOptions: [
        { id: 'small', amount: '200,000원' },
        { id: 'medium', amount: '300,000원' },
        { id: 'large', amount: '500,000원' },
      ],
    });
    expect(JSON.stringify(out)).not.toMatch(/\d{19}/);
  });

  it('shows the 30-day reset time in KST, not unix seconds', () => {
    const view = zBudgetView.parse({
      monthKst: '2026-12',
      personalBudget: '0',
      personalSpent: '0',
      nagLevel: 'none',
      chainCap: '0',
      chainUsed: '0',
      chainResetAtSec: 1_767_225_600,
      level: 1,
      perOrderLimit: '0',
      frozen: false,
      budgetOptions: [],
    });
    // 1767225600 = 2026-01-01T00:00:00Z = 2026-01-01 09:00 KST
    expect(budgetForModel(view).thirtyDayResetsAt).toBe('2026. 1. 1. 9시 0분');
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

  it('refuses a weather provider that is not wired instead of making weather up', async () => {
    const handlers = await setup({ WEATHER_PROVIDER: 'openmeteo' });
    await expect(handlers.get_context({ userId: 'u1' }, {})).rejects.toMatchObject({
      code: 'INTERNAL',
    });
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
        blocks: [{ tool: 'request_owner_approval', input: { reason: 'NEW_MERCHANT' } }],
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
