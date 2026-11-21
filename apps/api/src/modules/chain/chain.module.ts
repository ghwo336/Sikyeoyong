import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import type { PaymentProvider } from '@sikyeoyong/shared';
import { PaymentModule } from '../payment/payment.module.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { CHAIN_READER, ORDER_EVENTS } from './chain.service.js';
import { ChainIdGuard } from './chain-id-guard.js';
import { createChainReader } from './chain-reader.factory.js';
import { createOrderEvents } from './order-events.js';

@Module({
  imports: [PaymentModule],
  providers: [
    ChainIdGuard,
    {
      provide: CHAIN_READER,
      inject: [APP_CONFIG, PAYMENT_PROVIDER],
      useFactory: (config: AppConfig, payment: PaymentProvider) =>
        createChainReader(config, payment),
    },
    {
      provide: ORDER_EVENTS,
      inject: [APP_CONFIG, PAYMENT_PROVIDER],
      useFactory: (config: AppConfig, payment: PaymentProvider) =>
        createOrderEvents(config, payment),
    },
  ],
  exports: [CHAIN_READER, ORDER_EVENTS],
})
export class ChainModule {}
