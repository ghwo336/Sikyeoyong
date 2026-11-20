import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OrdersService } from '../orders/orders.service.js';
import { RECENT_ORDERS, type RecentOrdersReader } from './recent-orders.js';
import { RecommendService } from './recommend.service.js';
import { WeatherService } from './weather.service.js';

/** Deterministic recommendations and the weather source (recommend-and-nag.md). No HTTP route. */
@Module({
  imports: [BudgetModule, MerchantsModule, OrdersModule],
  providers: [
    RecommendService,
    WeatherService,
    {
      provide: RECENT_ORDERS,
      inject: [OrdersService],
      useFactory: (orders: OrdersService): RecentOrdersReader => ({
        since: (userId, sinceMs) => orders.recentOrdersSince(userId, sinceMs),
      }),
    },
  ],
  exports: [RecommendService, WeatherService],
})
export class RecommendModule {}
