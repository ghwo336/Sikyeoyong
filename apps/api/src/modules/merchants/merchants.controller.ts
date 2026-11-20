import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  type MerchantDetail,
  type MerchantList,
  type MerchantListQuery,
  zMerchantIdParam,
  zMerchantListQuery,
} from '@sikyeoyong/shared';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MerchantsService } from './merchants.service.js';

/** GET /api/merchants and /api/merchants/:id (tech-spec 3.2). HTTP only. */
@Controller('merchants')
@UseGuards(SessionGuard)
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(zMerchantListQuery)) query: MerchantListQuery): MerchantList {
    return { merchants: this.merchants.list({ category: query.category }) };
  }

  @Get(':id')
  detail(@Param('id', new ZodValidationPipe(zMerchantIdParam)) id: string): MerchantDetail {
    return this.merchants.detail(id);
  }
}
