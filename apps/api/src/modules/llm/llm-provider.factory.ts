import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';
import { AnthropicProvider, type MessagesClient } from './anthropic-provider.js';
import { DailyCapProvider } from './daily-cap-provider.js';
import type { LlmProvider } from './llm-provider.js';
import { ReplayProvider, TiredProvider } from './replay-provider.js';

/** The production client. Exported so a test can check the key reaches the SDK. */
export function defaultMessagesClient(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey });
}

/**
 * Picks the LlmProvider from config (D-22). Production always has LLM_MODEL and
 * ANTHROPIC_API_KEY (env.ts refuses to start otherwise). In development or tests
 * without them the server still boots, and a chat turn fails with INTERNAL
 * naming the missing variables, never their values. makeClient is the seam
 * tests use to see that the key, model and effort come from config.
 */
export function createLlmProvider(
  config: AppConfig,
  makeClient: (apiKey: string) => MessagesClient = defaultMessagesClient,
): LlmProvider {
  // D-26: rehearsals and development replay fixed turns, no API call.
  if (config.llm.mode === 'replay') return new ReplayProvider();
  const model = config.llm.model;
  const apiKey = config.secrets.anthropicApiKey;
  if (model === undefined || apiKey === undefined) {
    const variables = [
      ...(model === undefined ? ['LLM_MODEL'] : []),
      ...(apiKey === undefined ? ['ANTHROPIC_API_KEY'] : []),
    ];
    return {
      turn: () =>
        Promise.reject(new AppError('INTERNAL', { reason: 'llm not configured', variables })),
    };
  }
  const live = new AnthropicProvider(makeClient(apiKey), { model, effort: config.llm.effort });
  // D-26: past the day's token cap the dragon says it is tired instead of calling the API.
  return new DailyCapProvider(live, new TiredProvider(), config.llm.dailyTokenCap);
}
