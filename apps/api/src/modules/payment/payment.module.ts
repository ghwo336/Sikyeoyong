import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { createPaymentProvider, PAYMENT_PROVIDER } from './payment.service.js';

/**
 * Not global on purpose: only modules that pay (agents, orders) import it, and
 * the llm module never does (D-06, also a lint boundary). One provider per
 * process: the mock keeps its simulated chain in memory.
 */
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createPaymentProvider(config),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
