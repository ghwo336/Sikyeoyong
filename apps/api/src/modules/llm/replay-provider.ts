import type Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmTurnRequest } from './llm-provider.js';

/**
 * D-26: the dragon without the Claude API, for development and rehearsals. It reads the
 * user's latest words and plays a fixed turn: food words call recommend_merchants, budget
 * words call get_budget, then one line. The tools are the real server ones, so the cards
 * and numbers are real; only the dragon's words are fixed. It never calls place_order or
 * anything that writes (the orders come from the user's taps on the cards).
 */
const FOOD_WORDS = ['시켜', '추천', '점심', '저녁', '배고', '먹', '골라'];
const BUDGET_WORDS = ['예산', '다 쓴', '다쓴', '남았', '얼마', '한도'];

type Step =
  | { readonly kind: 'tool'; readonly tool: string }
  | { readonly kind: 'line'; readonly line: string };

/** Exported for tests: every tool a replay plan may call (they must all be read tools). */
export function plan(words: string): readonly Step[] {
  if (FOOD_WORDS.some((w) => words.includes(w))) {
    return [
      { kind: 'tool', tool: 'recommend_merchants' },
      { kind: 'line', line: '골라 봤어용. 마음에 드는 걸 눌러 주세용.' },
    ];
  }
  if (BUDGET_WORDS.some((w) => words.includes(w))) {
    return [
      { kind: 'tool', tool: 'get_budget' },
      { kind: 'line', line: '이번 달 쓴 돈은 위 막대에 있어용. 아껴 볼게용.' },
    ];
  }
  return [{ kind: 'line', line: '음, 그건 잘 모르겠어용. 뭐 먹고 싶은지 말해 주세용.' }];
}

/** The latest message the user typed (not a tool result) and how many dragon turns followed it. */
function latestUserWords(messages: readonly Anthropic.MessageParam[]): {
  text: string;
  after: number;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const text =
      typeof m.content === 'string'
        ? m.content
        : m.content
            .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
            .map((b) => b.text)
            .join(' ');
    const isToolResult =
      typeof m.content !== 'string' && m.content.some((b) => b.type === 'tool_result');
    if (isToolResult && text === '') continue;
    const after = messages.slice(i + 1).filter((x) => x.role === 'assistant').length;
    return { text, after };
  }
  return { text: '', after: 0 };
}

export class ReplayProvider implements LlmProvider {
  turn(
    request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    if (signal?.aborted) return Promise.reject(new Error('aborted'));
    const { text, after } = latestUserWords(request.messages);
    const steps = plan(text);
    const step = steps[Math.min(after, steps.length - 1)];
    const content: Anthropic.ContentBlock[] = [];
    let stop: Anthropic.StopReason = 'end_turn';
    if (step?.kind === 'tool') {
      content.push({
        type: 'tool_use',
        id: `toolu_replay_${String(after)}`,
        name: step.tool,
        input: {},
      } as Anthropic.ToolUseBlock);
      stop = 'tool_use';
    } else if (step?.kind === 'line') {
      onText(step.line);
      content.push({ type: 'text', text: step.line, citations: null });
    }
    return Promise.resolve({
      id: `msg_replay_${String(after)}`,
      type: 'message',
      role: 'assistant',
      model: 'replay',
      content,
      stop_reason: stop,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Message);
  }
}

/** tech-spec 9.5: past the day's token cap the dragon says it is tired, then plain words only. */
export const TIRED_LINE = '오늘은 많이 말해서 피곤해용. 내일 다시 이야기해용.';

/** D-26: the answer for the rest of the day once the live cap is reached: one fixed line, no tool. */
export class TiredProvider implements LlmProvider {
  turn(
    _request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    if (signal?.aborted) return Promise.reject(new Error('aborted'));
    onText(TIRED_LINE);
    return Promise.resolve({
      id: 'msg_tired',
      type: 'message',
      role: 'assistant',
      model: 'tired',
      content: [{ type: 'text', text: TIRED_LINE, citations: null }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Message);
  }
}
