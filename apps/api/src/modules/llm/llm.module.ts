import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import { BudgetModule } from '../budget/budget.module.js';
import { UsersModule } from '../users/users.module.js';
import { LlmToolHandlers } from './tools/handlers.js';
import type { AppConfig } from '../../config/env.js';
import { createLlmProvider } from './llm-provider.factory.js';
import { LLM_PROVIDER } from './llm-provider.js';

/** Binds LLM_PROVIDER from config and provides the tool handlers the chat runtime uses. */
@Module({
  imports: [BudgetModule, UsersModule],
  providers: [
    LlmToolHandlers,
    {
      provide: LLM_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createLlmProvider(config),
    },
  ],
  exports: [LLM_PROVIDER, LlmToolHandlers],
})
export class LlmModule {}
