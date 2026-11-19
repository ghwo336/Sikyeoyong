import type Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../../config/env.js';
import type { LlmProvider, LlmTurnRequest } from './llm-provider.js';

/** One definition with config (LLM_EFFORT). */
export type Effort = AppConfig['llm']['effort'];

export interface AnthropicProviderOptions {
  /** From LLM_MODEL (config only, never hardcoded). Demo: claude-opus-5-5 (D-22). */
  readonly model: string;
  readonly effort: Effort;
  /** Chat turns are short; 16k leaves room for thinking plus a tool call. */
  readonly maxTokens?: number;
}

/** The part of the SDK client this adapter uses, so tests can pass a fake. */
export interface MessagesClient {
  readonly messages: Pick<Anthropic['messages'], 'stream'>;
}

/**
 * Claude API behind LlmProvider. Streams text to the chat as it comes and
 * returns the whole message. No forced tool_choice (400 on Opus 5.5); the
 * tools are strict instead. The fixed system prompt and tool list form a
 * cached prefix, and the conversation is cached at its last block.
 */
export class AnthropicProvider implements LlmProvider {
  constructor(
    /** Public read-only so wiring tests can see what config reached the adapter. */
    readonly client: MessagesClient,
    readonly options: AnthropicProviderOptions,
  ) {}

  async turn(
    request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    const stream = this.client.messages.stream(
      {
        model: this.options.model,
        max_tokens: this.options.maxTokens ?? 16_000,
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        tools: request.tools,
        messages: request.messages,
        output_config: { effort: this.options.effort },
        cache_control: { type: 'ephemeral' },
      },
      { signal },
    );
    stream.on('text', (delta) => {
      onText(delta);
    });
    return stream.finalMessage();
  }
}
