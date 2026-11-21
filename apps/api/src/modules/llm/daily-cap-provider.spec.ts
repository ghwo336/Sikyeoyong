import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { DailyCapProvider } from './daily-cap-provider.js';
import type { LlmProvider } from './llm-provider.js';

const request = { system: 's', tools: [], messages: [] };
// One live turn bills 100 input + 50 output + 200 cache write + 50 cache read = 400 tokens.
const reply = (model: string, billed: boolean) =>
  ({
    model,
    content: [],
    stop_reason: 'end_turn',
    usage: billed
      ? {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 50,
        }
      : { input_tokens: 0, output_tokens: 0 },
  }) as unknown as Anthropic.Message;
const live: LlmProvider = { turn: () => Promise.resolve(reply('live', true)) };
const fallback: LlmProvider = { turn: () => Promise.resolve(reply('replay', false)) };
// 2026-12-10 23:59 KST, then the next KST day.
const LATE = Date.parse('2026-12-10T14:59:00.000Z');
const NEXT_DAY = Date.parse('2026-12-10T15:00:00.000Z');

describe('DailyCapProvider (D-26)', () => {
  it('counts live tokens and replays for the rest of the day once the cap is reached', async () => {
    let now = LATE;
    const p = new DailyCapProvider(live, fallback, 1_000, 0, () => now);
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
    const p = new DailyCapProvider(live, fallback, 0, 0, () => LATE);
    for (let i = 0; i < 5; i += 1) {
      expect((await p.turn(request, () => undefined)).model).toBe('live');
    }
  });

  it('counts input, output and both cache kinds; landing exactly on the cap stops the next turn', async () => {
    const p = new DailyCapProvider(live, fallback, 800, 0, () => LATE);
    await p.turn(request, () => undefined);
    expect(p.usedToday).toBe(400); // 100 + 50 + 200 + 50
    await p.turn(request, () => undefined);
    expect(p.usedToday).toBe(800); // exactly the cap
    expect((await p.turn(request, () => undefined)).model).toBe('replay');
  });

  describe('per-user cap', () => {
    const as = (userId: string) => ({ ...request, userId });
    it('stops one user at their own cap while another still gets live turns', async () => {
      const p = new DailyCapProvider(live, fallback, 100_000, 800, () => LATE);
      await p.turn(as('a'), () => undefined);
      await p.turn(as('a'), () => undefined);
      expect(p.usedTodayBy('a')).toBe(800);
      expect((await p.turn(as('a'), () => undefined)).model).toBe('replay');
      expect((await p.turn(as('b'), () => undefined)).model).toBe('live');
      expect(p.usedTodayBy('b')).toBe(400);
      expect(p.usedToday).toBe(1_200);
    });
    it('starts over on a new KST day', async () => {
      let now = LATE;
      const p = new DailyCapProvider(live, fallback, 0, 400, () => now);
      await p.turn(as('a'), () => undefined);
      expect((await p.turn(as('a'), () => undefined)).model).toBe('replay');
      now = NEXT_DAY;
      expect((await p.turn(as('a'), () => undefined)).model).toBe('live');
      expect(p.usedTodayBy('a')).toBe(400);
    });
    it('user cap 0 means none, and the global cap still wins', async () => {
      const none = new DailyCapProvider(live, fallback, 0, 0, () => LATE);
      for (let i = 0; i < 4; i += 1) await none.turn(as('a'), () => undefined);
      expect((await none.turn(as('a'), () => undefined)).model).toBe('live');
      const global = new DailyCapProvider(live, fallback, 400, 10_000, () => LATE);
      await global.turn(as('a'), () => undefined);
      expect((await global.turn(as('b'), () => undefined)).model).toBe('replay');
    });
  });
});
