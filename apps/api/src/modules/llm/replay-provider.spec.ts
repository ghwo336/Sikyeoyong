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

describe('ReplayProvider plans (D-26: never a tool that writes)', () => {
  it.each(SAMPLES)('"%s" calls read tools only', (words) => {
    for (const step of plan(words)) {
      if (step.kind === 'tool') expect(TOOL_KIND[step.tool as ToolName]).toBe('read');
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
