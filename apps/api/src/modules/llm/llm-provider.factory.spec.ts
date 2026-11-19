import Anthropic from '@anthropic-ai/sdk';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { AnthropicProvider, type MessagesClient } from './anthropic-provider.js';
import { createLlmProvider, defaultMessagesClient } from './llm-provider.factory.js';
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
    expect(p).toBeInstanceOf(AnthropicProvider);
  });

  // D-22: model, effort and key come from config, never from code.
  it('passes ANTHROPIC_API_KEY, LLM_MODEL and LLM_EFFORT through to the API call', async () => {
    const stream = vi.fn((_params: unknown) => ({
      on: () => undefined,
      finalMessage: () => Promise.resolve({ content: [], stop_reason: 'end_turn' }),
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
    expect(apiKeyOf(p)).toBe('test-key-default');
    const direct = defaultMessagesClient('k2');
    expect(direct instanceof Anthropic && direct.apiKey).toBe('k2');
  });

  // The path production runs: Nest injects APP_CONFIG and calls the factory with no seam.
  it('binds LLM_PROVIDER in the Nest module with the configured key, model and effort', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
      .useMocker((token) =>
        token === APP_CONFIG
          ? loadConfig({
              LLM_MODEL: 'test-model-nest',
              ANTHROPIC_API_KEY: 'test-key-nest',
              LLM_EFFORT: 'low',
            })
          : undefined,
      )
      .compile();
    const p = moduleRef.get<AnthropicProvider>(LLM_PROVIDER);
    expect(p).toBeInstanceOf(AnthropicProvider);
    expect(p.options).toEqual({ model: 'test-model-nest', effort: 'low' });
    expect(apiKeyOf(p)).toBe('test-key-nest');
  });
});
