import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import type { PaymentProvider } from '@sikyeoyong/shared';
import { PaymentModule } from '../payment/payment.module.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { CHAIN_READER } from './chain.service.js';
import { createChainReader } from './chain-reader.factory.js';

@Module({
  imports: [PaymentModule],
  providers: [
    {
      provide: CHAIN_READER,
      inject: [APP_CONFIG, PAYMENT_PROVIDER],
      useFactory: (config: AppConfig, payment: PaymentProvider) =>
        createChainReader(config, payment),
    },
  ],
  exports: [CHAIN_READER],
})
export class ChainModule {}
