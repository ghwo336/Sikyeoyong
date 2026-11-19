import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { CHAIN_READER } from './chain.service.js';
import { createChainReader } from './chain-reader.factory.js';

@Module({
  providers: [
    {
      provide: CHAIN_READER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createChainReader(config),
    },
  ],
  exports: [CHAIN_READER],
})
export class ChainModule {}
