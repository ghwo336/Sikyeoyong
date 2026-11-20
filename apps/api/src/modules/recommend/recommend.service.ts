import { Inject, Injectable } from '@nestjs/common';
import { parseAokrw } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { BudgetService } from '../budget/budget.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { RECENT_ORDERS, type RecentOrdersReader } from './recent-orders.js';
import { HABIT_WINDOW_MS, rank, type RankResult } from './score.js';
import { WeatherService } from './weather.service.js';

export type { ApprovalReason, EmptyReason, EmptyResult, Recommendation } from './score.js';
// Other modules import only <module>.service (architecture.md), so the weather source is re-exported here.
export { WeatherService } from './weather.service.js';

/** The ranked menus plus the weather they were ranked for. */
export type RecommendResult = RankResult & { readonly weather: string };

export interface RecommendInput {
  /** What the user said they want, as the model passed it on (a search word, not an order). */
  readonly craving?: string;
  readonly maxPriceAokrw?: bigint;
}

/**
 * Gathers the inputs and hands them to the pure scorer (tech-spec 3.8):
 * the two limits, the chain's 30-day use and frozen state from BudgetService, menus from
 * MerchantsService, weather from WeatherService (the same source as
 * get_context), recent orders through the RECENT_ORDERS port. Never reads
 * another module's tables.
 */
@Injectable()
export class RecommendService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly budget: BudgetService,
    private readonly merchants: MerchantsService,
    private readonly weather: WeatherService,
    @Inject(RECENT_ORDERS) private readonly recent: RecentOrdersReader,
  ) {}

  async recommend(
    userId: string,
    input: RecommendInput,
    nowMs: number = Date.now(),
  ): Promise<RecommendResult> {
    const view = await this.budget.getView(userId);
    const weather = this.weather.current();
    const recentOrders = this.recent
      .since(userId, nowMs - HABIT_WINDOW_MS)
      .map((o) => ({ ...o, category: this.merchants.categoryOf(o.merchantId) }));
    const result = rank({
      catalog: this.merchants.catalog(nowMs),
      nowMs,
      weather,
      ...(input.craving === undefined ? {} : { craving: input.craving }),
      ...(input.maxPriceAokrw === undefined ? {} : { maxPriceAokrw: input.maxPriceAokrw }),
      perOrderLimitAokrw: parseAokrw(view.perOrderLimit),
      myPeriodicLimitAokrw: parseAokrw(view.myPeriodicLimit),
      chainCapAokrw: parseAokrw(view.chainCap),
      chainUsedAokrw: parseAokrw(view.chainUsed),
      // Before the first order the window has not started: a whole period lies ahead.
      periodEndMs:
        view.chainResetAtSec === null
          ? nowMs + this.config.policy.periodicPeriodSec * 1000
          : view.chainResetAtSec * 1000,
      nagLevel: view.nagLevel,
      frozen: view.frozen,
      recentOrders,
    });
    return { ...result, weather };
  }
}
