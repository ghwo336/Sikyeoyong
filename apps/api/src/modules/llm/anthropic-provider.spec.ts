import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { AnthropicProvider, type MessagesClient } from './anthropic-provider.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { TOOL_DEFINITIONS } from './tools/index.js';

const FINAL = { id: 'msg_1', stop_reason: 'end_turn', content: [] } as unknown as Anthropic.Message;

function fakeClient() {
  const handlers: Record<string, (delta: string) => void> = {};
  const stream = vi.fn((_params: unknown) => ({
    on: (event: string, cb: (delta: string) => void) => {
      handlers[event] = cb;
    },
    finalMessage: () => {
      handlers.text?.('안녕');
      handlers.text?.('하세용');
      return Promise.resolve(FINAL);
    },
  }));
  return { client: { messages: { stream } } as unknown as MessagesClient, stream };
}

describe('AnthropicProvider', () => {
  it('sends the model, effort, strict tools and a cached system prompt; never forces a tool', async () => {
    const { client, stream } = fakeClient();
    const provider = new AnthropicProvider(client, { model: 'claude-opus-5-5', effort: 'medium' });
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: '점심 시켜 줘' }];
    await provider.turn(
      { system: SYSTEM_PROMPT, tools: TOOL_DEFINITIONS, messages },
      () => undefined,
    );
    const params = stream.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16_000,
      tools: TOOL_DEFINITIONS,
      messages,
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    });
    // Opus 5.5 rejects forced tool use and disabled thinking (400).
    expect(params).not.toHaveProperty('tool_choice');
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('temperature');
  });

  it('streams text deltas and returns the final message', async () => {
    const { client } = fakeClient();
    const provider = new AnthropicProvider(client, { model: 'm', effort: 'low' });
    const texts: string[] = [];
    const final = await provider.turn(
      { system: SYSTEM_PROMPT, tools: TOOL_DEFINITIONS, messages: [] },
      (t) => texts.push(t),
    );
    expect(texts).toEqual(['안녕', '하세용']);
    expect(final).toBe(FINAL);
  });
});
