import type Anthropic from '@anthropic-ai/sdk';
import { AppError, hasLimitIntent } from '@sikyeoyong/shared';
import type { LlmProvider } from './llm-provider.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import {
  isToolName,
  TOOL_DEFINITIONS,
  TOOL_INPUTS,
  TOOL_KIND,
  type ToolInput,
  type ToolName,
} from './tools/index.js';

/** Who is talking: always from the login session, never from model output (D-21). */
export interface SessionContext {
  readonly userId: string;
}

/**
 * Server functions behind each tool. Implemented by the budget, recommend,
 * orders, approvals and agents modules. Each gets the session context, so a
 * model-supplied id can only ever reach the session user's own data.
 */
export type ToolHandlers = {
  readonly [N in ToolName]: (ctx: SessionContext, input: ToolInput<N>) => Promise<unknown>;
};

export type RuntimeEvent =
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'tool_status'; readonly tool: ToolName; readonly state: 'start' | 'done' }
  | { readonly type: 'tool_output'; readonly tool: ToolName; readonly output: unknown }
  | { readonly type: 'stopped'; readonly reason: 'end' | 'refusal' | 'limit' };

export interface RuntimeLimits {
  /** Tool calls per user message (agent-runtime.md). */
  readonly maxToolCalls: number;
  /** place_order and request_owner_approval together, per user message. */
  readonly maxWriteCalls: number;
  /** propose_limit_change per user message (D-21). */
  readonly maxCardCalls: number;
  /** Model turns per user message, a backstop against loops. */
  readonly maxTurns: number;
}

export const DEFAULT_LIMITS: RuntimeLimits = {
  maxToolCalls: 8,
  maxWriteCalls: 1,
  maxCardCalls: 1,
  maxTurns: 10,
};

export interface RunInput {
  readonly ctx: SessionContext;
  /** Earlier turns (already summarized by the caller when long). */
  readonly history: Anthropic.MessageParam[];
  /** This turn's user text, the only text the D-21 intent gate reads. */
  readonly userText: string;
}

/** Tool results go back inside <data> so the model treats them as data (tech-spec 9.2). */
export function wrapData(value: unknown): string {
  return `<data>${JSON.stringify(value)}</data>`;
}

function errorResult(id: string, message: string): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, is_error: true, content: message };
}

/**
 * Runs one user message: model turn, whitelisted tools, repeat (tech-spec 3.3).
 * The guards here hold even if the model is fooled by injected text.
 */
export class AgentRuntime {
  constructor(
    private readonly provider: LlmProvider,
    private readonly handlers: ToolHandlers,
    private readonly limits: RuntimeLimits = DEFAULT_LIMITS,
  ) {}

  async run(
    input: RunInput,
    emit: (event: RuntimeEvent) => void,
  ): Promise<Anthropic.MessageParam[]> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history,
      { role: 'user', content: input.userText },
    ];
    const intent = hasLimitIntent(input.userText);
    let toolCalls = 0;
    let writeCalls = 0;
    let cardCalls = 0;

    for (let turn = 0; turn < this.limits.maxTurns; turn += 1) {
      const message = await this.provider.turn(
        { system: SYSTEM_PROMPT, tools: TOOL_DEFINITIONS, messages },
        (text) => {
          emit({ type: 'token', text });
        },
      );
      messages.push({ role: 'assistant', content: message.content });

      if (message.stop_reason === 'refusal') {
        emit({ type: 'stopped', reason: 'refusal' });
        return messages;
      }
      if (message.stop_reason === 'pause_turn') continue;

      const calls = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (calls.length === 0) {
        emit({ type: 'stopped', reason: 'end' });
        return messages;
      }
      if (message.stop_reason === 'max_tokens') {
        // A tool input cut off mid-way must never run.
        throw new AppError('INTERNAL', { reason: 'tool input truncated at max_tokens' });
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      let overLimit = false;
      for (const call of calls) {
        toolCalls += 1;
        if (toolCalls > this.limits.maxToolCalls) {
          overLimit = true;
          results.push(errorResult(call.id, '이번 메시지에서 도구를 더 부를 수 없다.'));
          continue;
        }
        results.push(await this.runTool(call, input, intent, { writeCalls, cardCalls }, emit));
        if (isToolName(call.name)) {
          if (TOOL_KIND[call.name] === 'write') writeCalls += 1;
          if (TOOL_KIND[call.name] === 'card') cardCalls += 1;
        }
      }
      messages.push({ role: 'user', content: results });
      if (overLimit) {
        emit({ type: 'stopped', reason: 'limit' });
        return messages;
      }
    }
    emit({ type: 'stopped', reason: 'limit' });
    return messages;
  }

  private async runTool(
    call: Anthropic.ToolUseBlock,
    input: RunInput,
    intent: boolean,
    used: { writeCalls: number; cardCalls: number },
    emit: (event: RuntimeEvent) => void,
  ): Promise<Anthropic.ToolResultBlockParam> {
    if (!isToolName(call.name)) {
      return errorResult(call.id, '없는 도구다.');
    }
    const name = call.name;
    const kind = TOOL_KIND[name];
    if (kind === 'write' && used.writeCalls >= this.limits.maxWriteCalls) {
      return errorResult(call.id, '이번 메시지에서 주문이나 승인 요청은 한 번만 할 수 있다.');
    }
    if (kind === 'card') {
      if (used.cardCalls >= this.limits.maxCardCalls) {
        return errorResult(call.id, '이번 메시지에서 한도 카드는 한 번만 띄울 수 있다.');
      }
      if (!intent) {
        // D-21: only the user's own words open this card, never text in tool results.
        return errorResult(
          call.id,
          '사용자가 한도나 예산을 바꾸자고 말하지 않았다. 카드를 띄우지 않는다.',
        );
      }
    }
    const parsed = TOOL_INPUTS[name].safeParse(call.input);
    if (!parsed.success) {
      return errorResult(call.id, '도구 입력이 형식에 맞지 않는다.');
    }
    emit({ type: 'tool_status', tool: name, state: 'start' });
    try {
      const handler = this.handlers[name] as (ctx: SessionContext, i: unknown) => Promise<unknown>;
      const output = await handler(input.ctx, parsed.data);
      emit({ type: 'tool_output', tool: name, output });
      emit({ type: 'tool_status', tool: name, state: 'done' });
      return { type: 'tool_result', tool_use_id: call.id, content: wrapData(output) };
    } catch (e) {
      emit({ type: 'tool_status', tool: name, state: 'done' });
      if (e instanceof AppError) {
        return errorResult(call.id, wrapData({ code: e.code, message: e.message }));
      }
      throw e;
    }
  }
}
