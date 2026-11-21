import type Anthropic from '@anthropic-ai/sdk';

/** One model turn: what the runtime sends (agent-runtime.md "LlmProvider"). */
export interface LlmTurnRequest {
  readonly system: string;
  readonly tools: Anthropic.Tool[];
  readonly messages: Anthropic.MessageParam[];
  /** Whose turn this is, for the per-user daily token cap. Absent counts against no one. */
  readonly userId?: string;
  /** Output ceiling for this call; absent means the adapter's default (REPLY_MAX_OUTPUT_TOKENS). */
  readonly maxTokens?: number;
}

/**
 * Wraps the Claude API so the runtime and the tests do not depend on the SDK
 * client. `onText` gets text as it streams; the promise resolves with the whole
 * assistant message (stop reason, tool calls).
 */
export interface LlmProvider {
  /** signal: the caller went away (client disconnected); stop and reject. */
  turn(
    request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
