import Anthropic from '@anthropic-ai/sdk';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { loadConfig } from '../../config/env.js';
import { AnthropicProvider, type MessagesClient } from './anthropic-provider.js';
import { DailyCapProvider } from './daily-cap-provider.js';
import { OpenAiProvider } from './openai-provider.js';
import { createLlmProvider, defaultMessagesClient } from './llm-provider.factory.js';
import { ReplayProvider, TIRED_LINE } from './replay-provider.js';
import { LLM_PROVIDER } from './llm-provider.js';
import { LlmModule } from './llm.module.js';

function apiKeyOf(provider: unknown): string | null {
  if (!(provider instanceof AnthropicProvider)) throw new Error('not the Claude adapter');
  const { client } = provider;
  if (!(client instanceof Anthropic)) throw new Error('not the SDK client');
  return client.apiKey;
}

const request = { system: 's', tools: [], messages: [] };

describe('createLlmProvider (D-22)', () => {
  it('uses the Claude adapter when model and key are set', () => {
    const p = createLlmProvider(
      loadConfig({ LLM_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test-key' }),
    );
    // D-26: the Claude adapter sits behind the daily token cap.
    if (!(p instanceof DailyCapProvider)) throw new Error('not capped');
    expect(p.live).toBeInstanceOf(AnthropicProvider);
  });

  it('live: one user at their own cap hears the tired line while another still gets the model', async () => {
    const stream = vi.fn((_params: unknown) => ({
      on: () => undefined,
      finalMessage: () =>
        Promise.resolve({
          content: [],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
    }));
    const p = createLlmProvider(
      loadConfig({
        LLM_MODEL: 'm',
        ANTHROPIC_API_KEY: 'k',
        LLM_DAILY_TOKEN_CAP: '1000',
        LLM_USER_DAILY_TOKEN_CAP: '2',
      }),
      () => ({ messages: { stream } }) as unknown as MessagesClient,
    );
    await p.turn({ ...request, userId: 'a' }, () => undefined);
    let said = '';
    await p.turn({ ...request, userId: 'a' }, (t) => {
      said += t;
    });
    expect(said).toBe(TIRED_LINE);
    await p.turn({ ...request, userId: 'b' }, () => undefined);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('live at the day cap: the next turn says the tired line and does not call the API (D-26)', async () => {
    const stream = vi.fn((_params: unknown) => ({
      on: () => undefined,
      finalMessage: () =>
        Promise.resolve({
          content: [],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
    }));
    const p = createLlmProvider(
      loadConfig({ LLM_MODEL: 'm', ANTHROPIC_API_KEY: 'k', LLM_DAILY_TOKEN_CAP: '1' }),
      () => ({ messages: { stream } }) as unknown as MessagesClient,
    );
    await p.turn(request, () => undefined);
    let said = '';
    const second = await p.turn(request, (t) => {
      said += t;
    });
    expect(said).toBe(TIRED_LINE);
    expect(second.content.every((b) => b.type === 'text')).toBe(true);
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('LLM_MODE=replay replays fixed turns and builds no client, key or not (D-26)', () => {
    const makeClient = vi.fn((_apiKey: string) => ({}) as MessagesClient);
    const p = createLlmProvider(
      loadConfig({ LLM_MODE: 'replay', LLM_MODEL: 'm', ANTHROPIC_API_KEY: 'k' }),
      makeClient,
    );
    expect(p).toBeInstanceOf(ReplayProvider);
    expect(makeClient).not.toHaveBeenCalled();
  });

  // D-22: model, effort and key come from config, never from code.
  it('passes ANTHROPIC_API_KEY, LLM_MODEL and LLM_EFFORT through to the API call', async () => {
    const stream = vi.fn((_params: unknown) => ({
      on: () => undefined,
      finalMessage: () =>
        Promise.resolve({
          content: [],
          stop_reason: 'end_turn',
          usage: { input_tokens: 0, output_tokens: 0 },
        }),
    }));
    const makeClient = vi.fn(
      (_apiKey: string) => ({ messages: { stream } }) as unknown as MessagesClient,
    );
    const p = createLlmProvider(
      loadConfig({ LLM_MODEL: 'test-model-x', ANTHROPIC_API_KEY: 'test-key-y', LLM_EFFORT: 'low' }),
      makeClient,
    );
    await p.turn(request, () => undefined);
    expect(makeClient).toHaveBeenCalledExactlyOnceWith('test-key-y');
    expect(stream.mock.calls[0]?.[0]).toMatchObject({
      model: 'test-model-x',
      output_config: { effort: 'low' },
    });
  });

  it('never builds a client without both values', () => {
    const makeClient = vi.fn((_apiKey: string) => ({}) as MessagesClient);
    createLlmProvider(loadConfig({ ANTHROPIC_API_KEY: 'k' }), makeClient);
    createLlmProvider(loadConfig({ LLM_MODEL: 'm' }), makeClient);
    expect(makeClient).not.toHaveBeenCalled();
  });

  it.each([
    [{}, ['LLM_MODEL', 'ANTHROPIC_API_KEY']],
    [{ LLM_MODEL: 'test-model' }, ['ANTHROPIC_API_KEY']],
    [{ ANTHROPIC_API_KEY: 'secret-value-xyz' }, ['LLM_MODEL']],
  ])('without full config %j a turn fails naming only the missing variables', async (env, vars) => {
    const p = createLlmProvider(loadConfig(env));
    const err = await p
      .turn(request, () => undefined)
      .then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INTERNAL');
    expect((err as AppError).detail).toMatchObject({ variables: vars });
    expect(JSON.stringify((err as AppError).detail)).not.toContain('secret-value-xyz');
  });

  it('the production client carries the configured key', () => {
    const p = createLlmProvider(
      loadConfig({ LLM_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test-key-default' }),
    );
    if (!(p instanceof DailyCapProvider)) throw new Error('not capped');
    expect(apiKeyOf(p.live)).toBe('test-key-default');
    const direct = defaultMessagesClient('k2');
    expect(direct instanceof Anthropic && direct.apiKey).toBe('k2');
  });

  // The path production runs: Nest injects APP_CONFIG and calls the factory with no seam.
  it('binds LLM_PROVIDER in the Nest module with the configured key, model and effort', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
      .useMocker((token) => {
        if (token === APP_CONFIG) {
          return loadConfig({
            LLM_MODEL: 'test-model-nest',
            ANTHROPIC_API_KEY: 'test-key-nest',
            LLM_EFFORT: 'low',
          });
        }
        // The module also builds tool handlers on the DB; this test only reads the provider.
        if (token === DB) return openDb(':memory:');
        return undefined;
      })
      .compile();
    const capped: unknown = moduleRef.get(LLM_PROVIDER);
    if (!(capped instanceof DailyCapProvider)) throw new Error('not capped');
    const p = capped.live;
    if (!(p instanceof AnthropicProvider)) throw new Error('not the Claude adapter');
    expect(p.options).toEqual({ model: 'test-model-nest', effort: 'low' });
    expect(apiKeyOf(p)).toBe('test-key-nest');
  });
});

describe('createLlmProvider with LLM_PROVIDER=openai (D-30)', () => {
  it('uses the OpenAI adapter behind the daily cap, with the OpenAI key, model and effort', () => {
    const makeChatClient = vi.fn((_key: string) => ({
      chat: { completions: { create: vi.fn() } },
    }));
    const makeClient = vi.fn();
    const p = createLlmProvider(
      loadConfig({ LLM_PROVIDER: 'openai', LLM_MODEL: 'gpt-test', OPENAI_API_KEY: 'sk-test' }),
      makeClient as never,
      makeChatClient,
    );
    if (!(p instanceof DailyCapProvider)) throw new Error('not capped');
    const live = p.live;
    if (!(live instanceof OpenAiProvider)) throw new Error('not the OpenAI adapter');
    expect(makeChatClient).toHaveBeenCalledWith('sk-test');
    expect(makeClient).not.toHaveBeenCalled();
    expect(live.options).toEqual({ model: 'gpt-test', effort: 'low' });
  });

  it('without OPENAI_API_KEY a turn fails naming that variable (an Anthropic key does not count)', async () => {
    const p = createLlmProvider(
      loadConfig({ LLM_PROVIDER: 'openai', LLM_MODEL: 'gpt-test', ANTHROPIC_API_KEY: 'k' }),
    );
    await expect(p.turn(request, () => undefined)).rejects.toMatchObject({
      code: 'INTERNAL',
      detail: { variables: ['OPENAI_API_KEY'] },
    });
  });
});
