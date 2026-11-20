import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DbMerchantSource } from './db-merchant-source.js';
import { MERCHANT_SOURCE } from './merchant-source.js';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsRepository } from './merchants.repository.js';
import { MerchantsService } from './merchants.service.js';

/** Merchants and menus (merchants.md). Other modules use MerchantsService only. */
@Module({
  imports: [AuthModule],
  controllers: [MerchantsController],
  providers: [
    MerchantsRepository,
    { provide: MERCHANT_SOURCE, useClass: DbMerchantSource },
    MerchantsService,
  ],
  exports: [MerchantsService],
})
export class MerchantsModule {}
