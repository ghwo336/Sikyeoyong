import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { createLlmProvider } from './llm-provider.factory.js';
import { LLM_PROVIDER } from './llm-provider.js';
import { LlmModule } from './llm.module.js';

const request = { system: 's', tools: [], messages: [] };

describe('createLlmProvider (D-22)', () => {
  it('uses the Claude adapter when model and key are set', () => {
    const p = createLlmProvider(
      loadConfig({ LLM_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test-key' }),
    );
    expect(p).toBeInstanceOf(AnthropicProvider);
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

  it('binds LLM_PROVIDER in the Nest module from APP_CONFIG', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
      .useMocker((token) =>
        token === APP_CONFIG
          ? loadConfig({ LLM_MODEL: 'test-model', ANTHROPIC_API_KEY: 'test-key' })
          : undefined,
      )
      .compile();
    expect(moduleRef.get(LLM_PROVIDER)).toBeInstanceOf(AnthropicProvider);
  });
});
