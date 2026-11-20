import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { Effort } from './anthropic-provider.js';
import type { LlmProvider, LlmTurnRequest } from './llm-provider.js';
import { toChatTools } from './tools/openai-tools.js';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Chunk = OpenAI.Chat.Completions.ChatCompletionChunk;

export interface OpenAiProviderOptions {
  /** From LLM_MODEL (config only, never hardcoded, D-30). */
  readonly model: string;
  /** LLM_EFFORT, sent as reasoning_effort (D-26: low by default). */
  readonly effort: Effort;
  readonly maxTokens?: number;
}

/** The part of the SDK client this adapter uses, so tests can pass a fake stream. */
export interface ChatClient {
  readonly chat: {
    readonly completions: {
      create(
        body: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        options?: { signal?: AbortSignal },
      ): Promise<AsyncIterable<Chunk>>;
    };
  };
}

/** Anthropic-shaped turn messages (what the runtime keeps) to OpenAI chat messages. */
export function toChatMessages(system: string, messages: Anthropic.MessageParam[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push(
        m.role === 'user'
          ? { role: 'user', content: m.content }
          : { role: 'assistant', content: m.content },
      );
      continue;
    }
    if (m.role === 'assistant') {
      const text = m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      const calls = m.content.flatMap((b) =>
        b.type === 'tool_use'
          ? [
              {
                id: b.id,
                type: 'function' as const,
                function: { name: b.name, arguments: JSON.stringify(b.input) },
              },
            ]
          : [],
      );
      out.push({
        role: 'assistant',
        content: text === '' ? null : text,
        ...(calls.length > 0 ? { tool_calls: calls } : {}),
      });
      continue;
    }
    // A user turn: tool results become tool messages (in order), any text one user message.
    const text: string[] = [];
    for (const b of m.content) {
      if (b.type === 'tool_result') {
        const content =
          typeof b.content === 'string'
            ? b.content
            : (b.content ?? []).flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('');
        out.push({
          role: 'tool',
          tool_call_id: b.tool_use_id,
          content: b.is_error === true ? `ERROR: ${content}` : content,
        });
      } else if (b.type === 'text') {
        text.push(b.text);
      }
    }
    if (text.length > 0) out.push({ role: 'user', content: text.join('\n') });
  }
  return out;
}

/** Tool arguments as JSON; a broken string becomes an input the runtime refuses (zod), not a crash. */
function parseArgs(args: string): unknown {
  if (args === '') return {};
  try {
    return JSON.parse(args) as unknown;
  } catch {
    return { __invalid_json: args };
  }
}

/**
 * OpenAI Chat Completions behind LlmProvider (D-30). Streams text to the chat as it comes,
 * gathers streamed tool calls, and answers in the Anthropic message shape the runtime already
 * reads (text and tool_use blocks, stop_reason, usage), so the runtime, the tools and the
 * daily token cap stay as they are. The money path is untouched: the tools are the same read
 * tools and place_order card (CLAUDE.md 3).
 */
export class OpenAiProvider implements LlmProvider {
  constructor(
    readonly client: ChatClient,
    readonly options: OpenAiProviderOptions,
  ) {}

  async turn(
    request: LlmTurnRequest,
    onText: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<Anthropic.Message> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.options.model,
        messages: toChatMessages(request.system, request.messages),
        tools: toChatTools(request.tools),
        reasoning_effort: this.options.effort,
        max_completion_tokens: this.options.maxTokens ?? 16_000,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal },
    );
    let text = '';
    let finish: string | null = null;
    let usage: Chunk['usage'] = null;
    const calls = new Map<number, { id: string; name: string; args: string }>();
    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices[0];
      if (choice === undefined) continue;
      const delta = choice.delta;
      if (typeof delta.content === 'string' && delta.content !== '') {
        text += delta.content;
        onText(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const seen = calls.get(tc.index) ?? { id: '', name: '', args: '' };
        if (tc.id) seen.id = tc.id;
        if (tc.function?.name) seen.name += tc.function.name;
        if (tc.function?.arguments) seen.args += tc.function.arguments;
        calls.set(tc.index, seen);
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }
    const content: Anthropic.ContentBlock[] = [];
    if (text !== '') content.push({ type: 'text', text, citations: null });
    for (const [, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
      const input = parseArgs(c.args);
      content.push({ type: 'tool_use', id: c.id, name: c.name, input } as Anthropic.ToolUseBlock);
    }
    const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      id: `openai-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: this.options.model,
      content,
      stop_reason:
        finish === 'tool_calls' || calls.size > 0
          ? 'tool_use'
          : finish === 'length'
            ? 'max_tokens'
            : finish === 'content_filter'
              ? 'refusal'
              : 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: (usage?.prompt_tokens ?? 0) - cached,
        output_tokens: usage?.completion_tokens ?? 0,
        cache_read_input_tokens: cached,
        cache_creation_input_tokens: 0,
      },
    } as unknown as Anthropic.Message;
  }
}
