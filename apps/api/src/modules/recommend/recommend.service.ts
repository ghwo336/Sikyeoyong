import { Inject, Injectable } from '@nestjs/common';
import { parseAokrw } from '@sikyeoyong/shared';
import { BudgetService } from '../budget/budget.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { RECENT_ORDERS, type RecentOrdersReader } from './recent-orders.js';
import { HABIT_WINDOW_MS, rank, type RankResult } from './score.js';
import { WeatherService } from './weather.service.js';

export type { ApprovalReason, Recommendation } from './score.js';
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
 * budget, level and frozen state from BudgetService, menus from
 * MerchantsService, weather from WeatherService (the same source as
 * get_context), recent orders through the RECENT_ORDERS port. Never reads
 * another module's tables.
 */
@Injectable()
export class RecommendService {
  constructor(
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
    const view = await this.budget.getView(userId, nowMs);
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
      personalBudgetAokrw: parseAokrw(view.personalBudget),
      personalSpentAokrw: parseAokrw(view.personalSpent),
      chainCapAokrw: parseAokrw(view.chainCap),
      chainUsedAokrw: parseAokrw(view.chainUsed),
      nagLevel: view.nagLevel,
      frozen: view.frozen,
      recentOrders,
    });
    return { ...result, weather };
  }
}
