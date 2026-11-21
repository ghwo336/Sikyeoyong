import { describe, expect, it } from 'vitest';
import { TIRED_LINE, TiredProvider, plan } from './replay-provider.js';
import { TOOL_KIND, type ToolName } from './tools/definitions.js';

const SAMPLES = [
  '점심 시켜 줘',
  '추천해 줘',
  '이번 달 얼마 남았어',
  '한도 알려 줘',
  '안녕',
  '돼지국밥으로',
];

const DEMO_SAMPLES = [
  '돼지국밥 시켜 줘',
  '보쌈 큰 걸로 시켜 줘',
  '한 번에 5만 원까지 올려 줘',
  '한도를 올려 줘',
];

describe('ReplayProvider plans (D-26: never a tool that writes)', () => {
  it.each([...SAMPLES, ...DEMO_SAMPLES])('"%s" calls read tools or the card tool only', (words) => {
    for (const step of plan(words)) {
      if (step.kind === 'tool')
        expect(['read', 'card']).toContain(TOOL_KIND[step.tool as ToolName]);
    }
  });
});

describe('demo turns (scenes 2, 3, 4)', () => {
  const tools = (words: string) =>
    plan(words).flatMap((s) => (s.kind === 'tool' ? [{ tool: s.tool, input: s.input }] : []));

  it('a named dish becomes that craving', () => {
    expect(tools('돼지국밥 시켜 줘')).toEqual([
      { tool: 'recommend_merchants', input: { craving: '돼지국밥' } },
    ]);
  });
  it('"5만 원까지 올려 줘" proposes a 50,000 per-order card', () => {
    expect(tools('한 번에 5만 원까지 올려 줘')).toEqual([
      { tool: 'propose_limit_change', input: { field: 'perOrder', amountOkrw: 50000 } },
    ]);
  });
  it('a raise with no amount the dragon can read stays the generic turn (no card)', () => {
    expect(tools('한도를 올려 줘').every((t) => t.tool !== 'propose_limit_change')).toBe(true);
  });
  it('every dragon line follows the tone rules: 용 ending, no dashes', () => {
    for (const words of [...DEMO_SAMPLES]) {
      for (const s of plan(words)) {
        if (s.kind === 'line') {
          expect(s.line).toMatch(/용[.?]?$/);
          expect(s.line).not.toMatch(/[\u2013\u2014]/);
        }
      }
    }
  });
});

describe('TiredProvider (tech-spec 9.5)', () => {
  it('says it is tired and calls nothing', async () => {
    let said = '';
    const m = await new TiredProvider().turn({ system: 's', tools: [], messages: [] }, (t) => {
      said += t;
    });
    expect(said).toBe(TIRED_LINE);
    expect(m.content.every((b) => b.type === 'text')).toBe(true);
    expect(m.stop_reason).toBe('end_turn');
  });
});
