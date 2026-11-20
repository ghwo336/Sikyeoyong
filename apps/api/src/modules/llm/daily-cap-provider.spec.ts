import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { DailyCapProvider } from './daily-cap-provider.js';
import type { LlmProvider } from './llm-provider.js';

const request = { system: 's', tools: [], messages: [] };
const reply = (model: string, tokens: number) =>
  ({
    model,
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: tokens, output_tokens: 0 },
  }) as unknown as Anthropic.Message;
const live: LlmProvider = { turn: () => Promise.resolve(reply('live', 400)) };
const fallback: LlmProvider = { turn: () => Promise.resolve(reply('replay', 0)) };
// 2026-12-10 23:59 KST, then the next KST day.
const LATE = Date.parse('2026-12-10T14:59:00.000Z');
const NEXT_DAY = Date.parse('2026-12-10T15:00:00.000Z');

describe('DailyCapProvider (D-26)', () => {
  it('counts live tokens and replays for the rest of the day once the cap is reached', async () => {
    let now = LATE;
    const p = new DailyCapProvider(live, fallback, 1_000, () => now);
    expect((await p.turn(request, () => undefined)).model).toBe('live'); // 400
    expect((await p.turn(request, () => undefined)).model).toBe('live'); // 800
    expect((await p.turn(request, () => undefined)).model).toBe('live'); // 1,200 (was under)
    expect(p.usedToday).toBe(1_200);
    expect((await p.turn(request, () => undefined)).model).toBe('replay');
    now = NEXT_DAY; // a new KST day starts the count over
    expect((await p.turn(request, () => undefined)).model).toBe('live');
    expect(p.usedToday).toBe(400);
  });

  it('cap 0 means no cap', async () => {
    const p = new DailyCapProvider(live, fallback, 0, () => LATE);
    for (let i = 0; i < 5; i += 1) {
      expect((await p.turn(request, () => undefined)).model).toBe('live');
    }
  });
});
