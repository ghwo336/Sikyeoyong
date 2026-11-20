import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { NO_RECENT_ORDERS, RECENT_ORDERS } from './recent-orders.js';
import { RecommendService } from './recommend.service.js';
import { WeatherService } from './weather.service.js';

/** Deterministic recommendations and the weather source (recommend-and-nag.md). No HTTP route. */
@Module({
  imports: [BudgetModule, MerchantsModule],
  providers: [
    RecommendService,
    WeatherService,
    { provide: RECENT_ORDERS, useValue: NO_RECENT_ORDERS },
  ],
  exports: [RecommendService, WeatherService],
})
export class RecommendModule {}
