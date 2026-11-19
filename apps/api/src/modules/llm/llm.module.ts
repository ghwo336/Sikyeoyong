import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BudgetModule } from '../budget/budget.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChatHistoryService } from './chat-history.service.js';
import { ChatController } from './chat.controller.js';
import { ChatRepository } from './chat.repository.js';
import { ChatService } from './chat.service.js';
import { LlmToolHandlers } from './tools/handlers.js';
import type { AppConfig } from '../../config/env.js';
import { createLlmProvider } from './llm-provider.factory.js';
import { LLM_PROVIDER } from './llm-provider.js';

/** The chat endpoint, its runtime wiring, LLM_PROVIDER from config and the tool handlers. */
@Module({
  imports: [AuthModule, BudgetModule, UsersModule, RateLimitModule],
  controllers: [ChatController],
  providers: [
    LlmToolHandlers,
    ChatRepository,
    ChatService,
    ChatHistoryService,
    {
      provide: LLM_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createLlmProvider(config),
    },
  ],
  exports: [LLM_PROVIDER, LlmToolHandlers],
})
export class LlmModule {}
