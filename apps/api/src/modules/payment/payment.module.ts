import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import type { PaymentProvider } from '@sikyeoyong/shared';
import {
  createOwnerAuthority,
  createPaymentProvider,
  OWNER_AUTHORITY,
  PAYMENT_PROVIDER,
} from './payment.service.js';

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
    {
      provide: OWNER_AUTHORITY,
      inject: [APP_CONFIG, PAYMENT_PROVIDER],
      useFactory: (config: AppConfig, payment: PaymentProvider) =>
        createOwnerAuthority(config, payment),
    },
  ],
  exports: [PAYMENT_PROVIDER, OWNER_AUTHORITY],
})
export class PaymentModule {}
