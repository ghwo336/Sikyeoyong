import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { type ChatClient, OpenAiProvider, toChatMessages } from './openai-provider.js';
import { toChatTools } from './tools/openai-tools.js';

type Chunk = OpenAI.Chat.Completions.ChatCompletionChunk;

const chunk = (delta: object, finish: string | null = null, usage?: object): Chunk =>
  ({
    id: 'c1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'm',
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...(usage === undefined ? {} : { usage }),
  }) as unknown as Chunk;

function fake(chunks: Chunk[]) {
  const create = vi.fn((_body: unknown, _opts?: unknown) =>
    Promise.resolve(
      (async function* () {
        for (const c of chunks) yield await Promise.resolve(c);
      })(),
    ),
  );
  return { client: { chat: { completions: { create } } } as unknown as ChatClient, create };
}

const request = {
  system: '너는 용이',
  tools: [
    {
      name: 'get_budget',
      description: '예산',
      strict: true,
      input_schema: { type: 'object' as const, properties: {}, additionalProperties: false },
    },
  ],
  messages: [{ role: 'user' as const, content: '점심 시켜 줘' }],
};

describe('OpenAiProvider (D-30)', () => {
  it('streams text, sends model, effort and our tools, and maps usage for the daily cap', async () => {
    const { client, create } = fake([
      chunk({ content: '국물 ' }),
      chunk({ content: '어때용?' }),
      chunk({}, 'stop'),
      {
        ...chunk({}),
        choices: [],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
          prompt_tokens_details: { cached_tokens: 60 },
        },
      },
    ]);
    const said: string[] = [];
    const m = await new OpenAiProvider(client, { model: 'gpt-test', effort: 'low' }).turn(
      request,
      (t) => said.push(t),
    );
    expect(said).toEqual(['국물 ', '어때용?']);
    expect(m.content).toEqual([{ type: 'text', text: '국물 어때용?', citations: null }]);
    expect(m.stop_reason).toBe('end_turn');
    // 100 prompt of which 60 cached + 20 out: the cap counts 40 + 20 + 60 = 120.
    expect(m.usage).toMatchObject({
      input_tokens: 40,
      output_tokens: 20,
      cache_read_input_tokens: 60,
    });
    const body = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'gpt-test', reasoning_effort: 'low', stream: true });
    expect(body.messages).toEqual([
      { role: 'system', content: '너는 용이' },
      { role: 'user', content: '점심 시켜 줘' },
    ]);
  });

  it('gathers streamed tool calls into tool_use blocks the runtime reads', async () => {
    const { client } = fake([
      chunk({
        tool_calls: [
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'recommend_', arguments: '{"cra' },
          },
        ],
      }),
      chunk({
        tool_calls: [{ index: 0, function: { name: 'merchants', arguments: 'ving":"국물"}' } }],
      }),
      chunk({
        tool_calls: [{ index: 1, id: 'call_2', function: { name: 'get_budget', arguments: '' } }],
      }),
      chunk({}, 'tool_calls'),
    ]);
    const m = await new OpenAiProvider(client, { model: 'm', effort: 'low' }).turn(
      request,
      () => undefined,
    );
    expect(m.stop_reason).toBe('tool_use');
    expect(m.content).toEqual([
      { type: 'tool_use', id: 'call_1', name: 'recommend_merchants', input: { craving: '국물' } },
      { type: 'tool_use', id: 'call_2', name: 'get_budget', input: {} },
    ]);
  });

  it('broken tool arguments become an input the runtime refuses, not a crash', async () => {
    const { client } = fake([
      chunk({
        tool_calls: [{ index: 0, id: 'c', function: { name: 'get_menu', arguments: '{"merch' } }],
      }),
      chunk({}, 'tool_calls'),
    ]);
    const m = await new OpenAiProvider(client, { model: 'm', effort: 'low' }).turn(
      request,
      () => undefined,
    );
    expect(m.content[0]).toMatchObject({ type: 'tool_use', input: { __invalid_json: '{"merch' } });
  });

  it.each([
    ['length', 'max_tokens'],
    ['content_filter', 'refusal'],
  ])('finish %s is stop_reason %s', async (finish, stop) => {
    const { client } = fake([chunk({ content: 'x' }), chunk({}, finish)]);
    const m = await new OpenAiProvider(client, { model: 'm', effort: 'low' }).turn(
      request,
      () => undefined,
    );
    expect(m.stop_reason).toBe(stop);
  });
});

describe('toChatMessages', () => {
  it('turns tool_use into tool_calls and tool_result into tool messages, in order', () => {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: '예산 알려 줘' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '볼게용', citations: null },
          { type: 'tool_use', id: 't1', name: 'get_budget', input: {} },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: '<data>ok</data>' },
          {
            type: 'tool_result',
            tool_use_id: 't2',
            content: [{ type: 'text', text: 'bad' }],
            is_error: true,
          },
        ],
      },
    ];
    expect(toChatMessages('sys', messages)).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: '예산 알려 줘' },
      {
        role: 'assistant',
        content: '볼게용',
        tool_calls: [
          { id: 't1', type: 'function', function: { name: 'get_budget', arguments: '{}' } },
        ],
      },
      { role: 'tool', tool_call_id: 't1', content: '<data>ok</data>' },
      { role: 'tool', tool_call_id: 't2', content: 'ERROR: bad' },
    ]);
  });
});

describe('toChatTools', () => {
  it('sends our tools as functions, not strict (the server re-checks inputs, D-30)', () => {
    expect(toChatTools(request.tools)).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_budget',
          description: '예산',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
    ]);
  });
});
