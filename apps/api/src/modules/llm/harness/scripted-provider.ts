import type Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmTurnRequest } from '../llm-provider.js';

/**
 * Layer 1 of the LLM harness: replays recorded or hand-written model turns, no
 * network and no cost. It plays a model that may be fooled on purpose, so the
 * tests prove the server-side guards, not the model's good behavior.
 */
export type ScriptedBlock =
  { readonly text: string } | { readonly tool: string; readonly input: unknown };

export interface ScriptedTurn {
  readonly blocks: readonly ScriptedBlock[];
  readonly stop?: Anthropic.StopReason;
}

export class ScriptedProvider implements LlmProvider {
  readonly requests: LlmTurnRequest[] = [];
  private next = 0;

  constructor(private readonly turns: readonly ScriptedTurn[]) {}

  turn(request: LlmTurnRequest, onText: (text: string) => void): Promise<Anthropic.Message> {
    // Copy the messages: the runtime keeps appending to the same array.
    this.requests.push({ ...request, messages: [...request.messages] });
    const scripted = this.turns[this.next];
    this.next += 1;
    if (!scripted) {
      return Promise.reject(new Error(`script has no turn ${String(this.next)}`));
    }
    const content: Anthropic.ContentBlock[] = scripted.blocks.map((b, i) => {
      if ('text' in b) {
        onText(b.text);
        return { type: 'text', text: b.text, citations: null };
      }
      return {
        type: 'tool_use',
        id: `toolu_${String(this.next)}_${String(i)}`,
        name: b.tool,
        input: b.input,
      } as Anthropic.ToolUseBlock;
    });
    const hasTool = scripted.blocks.some((b) => 'tool' in b);
    return Promise.resolve({
      id: `msg_${String(this.next)}`,
      type: 'message',
      role: 'assistant',
      model: 'scripted',
      content,
      stop_reason: scripted.stop ?? (hasTool ? 'tool_use' : 'end_turn'),
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Message);
  }

  /** The tool_result blocks the runtime sent back after a given turn (1-based). */
  resultsAfter(turn: number): Anthropic.ToolResultBlockParam[] {
    const req = this.requests[turn];
    const last = req?.messages[req.messages.length - 1];
    if (!last || typeof last.content === 'string') return [];
    const out: Anthropic.ToolResultBlockParam[] = [];
    for (const b of last.content) {
      if (b.type === 'tool_result') out.push(b);
    }
    return out;
  }
}
