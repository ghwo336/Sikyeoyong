import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import { createLlmProvider } from './llm-provider.factory.js';
import { LLM_PROVIDER } from './llm-provider.js';

/** Binds LLM_PROVIDER from config. The chat module adds the runtime and tool handlers. */
@Module({
  providers: [{ provide: LLM_PROVIDER, inject: [APP_CONFIG], useFactory: createLlmProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
