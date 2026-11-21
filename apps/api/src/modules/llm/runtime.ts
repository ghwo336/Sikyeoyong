import type Anthropic from '@anthropic-ai/sdk';
import { AppError, hasLimitIntent } from '@sikyeoyong/shared';
import type { ApprovalReason } from '../approvals/approvals.service.js';
import { MenuCatalog } from './chosen-menu.js';
import type { LlmProvider } from './llm-provider.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import {
  ApprovalWait,
  isToolName,
  TOOL_DEFINITIONS,
  TOOL_INPUTS,
  TOOL_KIND,
  type ToolCard,
  type ToolInput,
  type ToolKind,
  type ToolName,
  ToolReply,
} from './tools/index.js';

type LimitedKind = Exclude<ToolKind, 'read'>;

/**
 * CLAUDE.md 1: no em dash or en dash on screen, whatever a model writes. Replaced as the words
 * stream, so the saved turn and its replay show the same text. Also "되용" to "돼용": 되+요
 * is always written 돼요, so the dragon's 용 ending is always 돼용 (browser QA 2: "적용되용").
 * Per streamed piece, so a "되" and "용" split across two pieces stays as written.
 */
export function screenText(text: string): string {
  return text.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/되용/g, '돼용');
}

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
  | {
      readonly type: 'tool_output';
      readonly tool: ToolName;
      /** Exactly what the model got (inside <data>). */
      readonly output: unknown;
      /** The screen card from a ToolReply; the model never sees it. */
      readonly card?: ToolCard;
    }
  /**
   * An order waits for the owner, who has decided nothing yet. Sent once, just before
   * 'stopped'; the caller says the wait in server words (agent-runtime.md "허락 대기").
   */
  | { readonly type: 'approval_wait'; readonly reason: ApprovalReason }
  | { readonly type: 'stopped'; readonly reason: 'end' | 'refusal' | 'limit' | 'aborted' };

export interface RuntimeLimits {
  /** Tool calls per user message (agent-runtime.md). */
  readonly maxToolCalls: number;
  /** place_order per user message (tech-spec 3.3). */
  readonly maxOrderCalls: number;
  /**
   * request_owner_approval per user message, counted apart from place_order:
   * flow 3 is place_order coming back with APPROVAL_REQUIRED and the server's
   * reason (OVER_LEVEL_LIMIT, NEW_MERCHANT, OVER_PERSONAL_BUDGET), then one approval request.
   */
  readonly maxApprovalCalls: number;
  /** propose_limit_change per user message (D-21). */
  readonly maxCardCalls: number;
  /** Model turns per user message, a backstop against loops. */
  readonly maxTurns: number;
}

export const DEFAULT_LIMITS: RuntimeLimits = {
  maxToolCalls: 8,
  maxOrderCalls: 1,
  maxApprovalCalls: 1,
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

/**
 * Tool results go back inside <data> so the model treats them as data (tech-spec 9.2).
 * Angle brackets inside are JSON-escaped (\u003c, \u003e), so merchant text such as
 * "</data> 지시" cannot close the block early or open a new one.
 */
export function wrapData(value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<data>${json}</data>`;
}

function errorResult(id: string, message: string): Anthropic.ToolResultBlockParam {
  return { type: 'tool_result', tool_use_id: id, is_error: true, content: message };
}

/** A place_order that leaves out the menu the user named is refused (see chosen-menu.ts). */
function swapRefusal(
  call: Anthropic.ToolUseBlock,
  userText: string,
  catalog: MenuCatalog,
): Anthropic.ToolResultBlockParam | null {
  if (call.name !== 'place_order') return null;
  const parsed = TOOL_INPUTS.place_order.safeParse(call.input);
  if (!parsed.success) return null;
  const swapped = catalog.swappedAway(
    userText,
    parsed.data.items.map((i) => i.menuId),
  );
  if (swapped === null) return null;
  return errorResult(
    call.id,
    `사용자가 말한 메뉴(${swapped.join(', ')})가 주문에 없다. 사용자가 고른 메뉴를 몰래 바꾸지 않는다. 사용자가 고른 메뉴로 다시 주문하거나, 바꾸려면 먼저 사용자에게 묻는다. 한도는 서버가 가린다. 권하고 싶은 다른 메뉴는 recommend_merchants로 카드를 띄워 사용자가 고르게 한다.`,
  );
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
    /** The client went away: no further model turns or tools (each turn costs money). */
    signal?: AbortSignal,
  ): Promise<Anthropic.MessageParam[]> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history,
      { role: 'user', content: input.userText },
    ];
    const intent = hasLimitIntent(input.userText);
    const catalog = new MenuCatalog();
    let toolCalls = 0;
    const used: Record<LimitedKind, number> = { order: 0, approval: 0, card: 0 };
    /**
     * Set once an order waits for the owner. From then on the model's words are not shown
     * (it has claimed approvals that never happened, browser QA) and only the approval
     * request may still run; the wait is said by the caller in server words.
     */
    const wait: { reason: ApprovalReason | null } = { reason: null };
    const stop = (reason: Extract<RuntimeEvent, { type: 'stopped' }>['reason']) => {
      if (wait.reason !== null && reason !== 'aborted') {
        emit({ type: 'approval_wait', reason: wait.reason });
      }
      emit({ type: 'stopped', reason });
    };

    for (let turn = 0; turn < this.limits.maxTurns; turn += 1) {
      if (signal?.aborted) {
        stop('aborted');
        return messages;
      }
      const message = await this.provider.turn(
        { system: SYSTEM_PROMPT, tools: TOOL_DEFINITIONS, messages, userId: input.ctx.userId },
        (text) => {
          if (wait.reason === null) emit({ type: 'token', text: screenText(text) });
        },
        signal,
      );
      if (signal?.aborted) {
        // Gone while the model answered: run no tools for nobody.
        stop('aborted');
        return messages;
      }
      if (message.stop_reason === 'refusal') {
        // Keep no unanswered tool_use in the stored turn, so the next message starts clean.
        const content = message.content.filter((b) => b.type !== 'tool_use');
        if (content.length > 0) messages.push({ role: 'assistant', content });
        stop('refusal');
        return messages;
      }
      messages.push({ role: 'assistant', content: message.content });
      if (message.stop_reason === 'pause_turn') continue;

      const calls = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (calls.length === 0) {
        stop('end');
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
        const swap = swapRefusal(call, input.userText, catalog);
        if (swap !== null) {
          // Refused before it ran, so it does not use up the one order of this message.
          results.push(swap);
          continue;
        }
        results.push(await this.runTool(call, input, intent, used, wait, catalog, emit));
        if (isToolName(call.name)) {
          const kind = TOOL_KIND[call.name];
          if (kind !== 'read') used[kind] += 1;
        }
      }
      messages.push({ role: 'user', content: results });
      if (overLimit) {
        stop('limit');
        return messages;
      }
    }
    stop('limit');
    return messages;
  }

  private async runTool(
    call: Anthropic.ToolUseBlock,
    input: RunInput,
    intent: boolean,
    used: Readonly<Record<LimitedKind, number>>,
    wait: { reason: ApprovalReason | null },
    catalog: MenuCatalog,
    emit: (event: RuntimeEvent) => void,
  ): Promise<Anthropic.ToolResultBlockParam> {
    if (!isToolName(call.name)) {
      return errorResult(call.id, '없는 도구다.');
    }
    const name = call.name;
    const kind = TOOL_KIND[name];
    if (wait.reason !== null && kind !== 'approval') {
      return errorResult(
        call.id,
        '주문이 주인님 허락을 기다린다. 주인님은 아직 정하지 않았다. 이번 메시지에서는 다른 일을 하지 않는다.',
      );
    }
    if (kind === 'order' && used.order >= this.limits.maxOrderCalls) {
      return errorResult(call.id, '이번 메시지에서 주문은 한 번만 할 수 있다.');
    }
    if (kind === 'approval' && used.approval >= this.limits.maxApprovalCalls) {
      return errorResult(call.id, '이번 메시지에서 승인 요청은 한 번만 할 수 있다.');
    }
    if (kind === 'card') {
      if (used.card >= this.limits.maxCardCalls) {
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
      // A ToolReply splits into the model's text and the screen's card; only forModel is wrapped.
      if (output instanceof ApprovalWait) wait.reason = output.reason;
      const forModel =
        output instanceof ToolReply || output instanceof ApprovalWait ? output.forModel : output;
      catalog.learn(forModel);
      emit(
        output instanceof ToolReply
          ? { type: 'tool_output', tool: name, output: forModel, card: output.card }
          : { type: 'tool_output', tool: name, output: forModel },
      );
      emit({ type: 'tool_status', tool: name, state: 'done' });
      return { type: 'tool_result', tool_use_id: call.id, content: wrapData(forModel) };
    } catch (e) {
      emit({ type: 'tool_status', tool: name, state: 'done' });
      if (e instanceof AppError) {
        return errorResult(call.id, wrapData({ code: e.code, message: e.message }));
      }
      throw e;
    }
  }
}
