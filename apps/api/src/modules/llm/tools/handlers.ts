import { Injectable } from '@nestjs/common';
import {
  AppError,
  type BudgetView,
  formatKstClock,
  formatKstDate,
  formatOkrw,
  parseAokrw,
} from '@sikyeoyong/shared';
import { BudgetService } from '../../budget/budget.service.js';
import { MerchantsService } from '../../merchants/merchants.service.js';
import { RecommendService, WeatherService } from '../../recommend/recommend.service.js';
import { UsersService } from '../../users/users.service.js';
import type { SessionContext, ToolHandlers } from '../runtime.js';
import type { ToolName } from './definitions.js';
import { menuForModel, recommendReply } from './merchant-views.js';

const won = (aokrw: string) => formatOkrw(parseAokrw(aokrw));
const kstTime = (unixMs: number) => `${formatKstDate(unixMs)} ${formatKstClock(unixMs)}`;

/**
 * What get_budget shows the model: amounts already in the one display format
 * ("300,000원") and the reset time already in KST, so the model never converts
 * units and only repeats numbers the server made (CLAUDE.md rule 4, tech-spec 3.3).
 * The HTTP BudgetView stays in aokrw for the screens.
 */
export function budgetForModel(view: BudgetView) {
  return {
    month: view.monthKst,
    personalBudget: won(view.personalBudget),
    personalSpent: won(view.personalSpent),
    nagLevel: view.nagLevel,
    thirtyDayCap: won(view.chainCap),
    thirtyDayUsed: won(view.chainUsed),
    thirtyDayResetsAt: view.chainResetAtSec === null ? null : kstTime(view.chainResetAtSec * 1000),
    level: view.level,
    perOrderLimit: won(view.perOrderLimit),
    frozen: view.frozen,
    budgetOptions: view.budgetOptions.map((o) => ({ id: o.id, amount: won(o.amount) })),
  };
}

/**
 * The server functions behind the tools. Every handler takes the user from the
 * session context, never from model input. Tools whose modules are not built
 * yet answer with an AppError, which the runtime hands back to the model as an
 * error result, so the dragon says it cannot do that yet instead of guessing.
 */
@Injectable()
export class LlmToolHandlers {
  constructor(
    private readonly budget: BudgetService,
    private readonly users: UsersService,
    private readonly weather: WeatherService,
    private readonly recommender: RecommendService,
    private readonly merchants: MerchantsService,
  ) {}

  /** nowMs is a seam for tests. */
  build(now: () => number = Date.now): ToolHandlers {
    const notReady = (tool: ToolName) => () =>
      Promise.reject(new AppError('INTERNAL', { reason: 'tool not ready', tool }));
    return {
      get_budget: (ctx: SessionContext) =>
        this.budget.getView(ctx.userId, now()).then(budgetForModel),
      get_context: (ctx: SessionContext) => Promise.resolve().then(() => this.context(ctx, now())),
      get_order_history: notReady('get_order_history'),
      recommend_merchants: (ctx, input) =>
        this.recommender.recommend(ctx.userId, input, now()).then(recommendReply),
      // Merchants are not per user; a hidden or unknown id is NOT_FOUND back to the model.
      get_menu: (_ctx, input) =>
        Promise.resolve().then(() => menuForModel(this.merchants.detail(input.merchantId, now()))),
      place_order: notReady('place_order'),
      request_owner_approval: notReady('request_owner_approval'),
      propose_limit_change: notReady('propose_limit_change'),
    };
  }

  private context(ctx: SessionContext, nowMs: number) {
    // The same weather source as recommend_merchants, so the two never disagree.
    const weather = this.weather.current();
    return {
      // Year included so the model never guesses it; 24-hour clock avoids 오전/오후 slips.
      nowKst: kstTime(nowMs),
      dong: this.users.getAddressDong(ctx.userId),
      weather,
    };
  }
}
