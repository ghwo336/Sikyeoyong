import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type BudgetView,
  formatKstClock,
  formatKstDate,
  formatOkrw,
  parseAokrw,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../../common/ids.js';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import { BudgetService } from '../../budget/budget.service.js';
import { MerchantsService } from '../../merchants/merchants.service.js';
import { OrdersService } from '../../orders/orders.service.js';
import { RecommendService, WeatherService } from '../../recommend/recommend.service.js';
import { UsersService } from '../../users/users.service.js';
import type { SessionContext, ToolHandlers } from '../runtime.js';
import type { ToolName } from './definitions.js';
import { limitCardReply } from './limit-card-views.js';
import { menuForModel, recommendReply } from './merchant-views.js';
import { approvalRequestReply, placeOrderReply } from './order-views.js';

const won = (aokrw: string) => formatOkrw(parseAokrw(aokrw));
const kstTime = (unixMs: number) => `${formatKstDate(unixMs)} ${formatKstClock(unixMs)}`;

/**
 * What get_budget shows the model: amounts already in the one display format
 * ("300,000원") and the reset time already in KST, so the model never converts
 * units and only repeats numbers the server made (CLAUDE.md rule 4, tech-spec 3.3).
 * The HTTP BudgetView stays in aokrw for the screens.
 */
export function budgetForModel(view: BudgetView) {
  const range = (r: BudgetView['limitRanges']['perOrder']) => ({
    min: won(r.min),
    max: won(r.max),
    step: won(r.step),
  });
  return {
    perOrderLimit: won(view.perOrderLimit),
    myThirtyDayLimit: won(view.myPeriodicLimit),
    thirtyDayUsed: won(view.chainUsed),
    nagLevel: view.nagLevel,
    thirtyDayCap: won(view.chainCap),
    thirtyDayResetsAt: view.chainResetAtSec === null ? null : kstTime(view.chainResetAtSec * 1000),
    frozen: view.frozen,
    ranges: {
      perOrderLimit: range(view.limitRanges.perOrder),
      myThirtyDayLimit: range(view.limitRanges.myPeriodic),
    },
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
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly budget: BudgetService,
    private readonly users: UsersService,
    private readonly weather: WeatherService,
    private readonly recommender: RecommendService,
    private readonly merchants: MerchantsService,
    private readonly orders: OrdersService,
  ) {}

  /** nowMs is a seam for tests. */
  build(now: () => number = Date.now): ToolHandlers {
    const notReady = (tool: ToolName) => () =>
      Promise.reject(new AppError('INTERNAL', { reason: 'tool not ready', tool }));
    return {
      get_budget: (ctx: SessionContext) => this.budget.getView(ctx.userId).then(budgetForModel),
      get_context: (ctx: SessionContext) => this.context(ctx, now()),
      get_order_history: notReady('get_order_history'),
      recommend_merchants: (ctx, input) =>
        this.recommender.recommend(ctx.userId, input, now()).then(recommendReply),
      // Merchants are not per user; a hidden or unknown id is NOT_FOUND back to the model.
      get_menu: (_ctx, input) =>
        Promise.resolve().then(() => menuForModel(this.merchants.detail(input.merchantId, now()))),
      // A quote and a confirm card only; paying is the card's button (CLAUDE.md rule 3).
      // No amount in the input: the server prices the items. The user is the session's.
      place_order: (ctx, input) =>
        this.orders
          .quote(
            ctx.userId,
            {
              merchantId: input.merchantId,
              items: input.items,
              clientOrderId: null,
              ...(input.note === undefined ? {} : { note: input.note }),
            },
            now(),
          )
          .then(placeOrderReply),
      // Asks the owner; never approves or pays. The reason input is ignored: the server decides.
      request_owner_approval: (ctx, input) =>
        this.orders
          .requestApproval(
            ctx.userId,
            {
              ...(input.merchantId === undefined ? {} : { merchantId: input.merchantId }),
              ...(input.items === undefined ? {} : { items: input.items }),
              ...(input.message === undefined ? {} : { message: input.message }),
            },
            now(),
          )
          .then(approvalRequestReply),
      // A card only, never a change (CLAUDE.md rule 3, D-21, D-31). The runtime already checked
      // the user's own words; range, step, same value and the card's numbers are the server's.
      propose_limit_change: (ctx, input) =>
        this.budget
          .getView(ctx.userId)
          .then((view) => limitCardReply(this.config.policy, view, input, uuidv7(now()))),
    };
  }

  private async context(ctx: SessionContext, nowMs: number) {
    // The same weather source as recommend_merchants, so the two never disagree.
    // null = provider down: said as unknown, never a made-up sky (the prompt only trusts tool results).
    const weather = await this.weather.current(nowMs);
    return {
      // Year included so the model never guesses it; 24-hour clock avoids 오전/오후 slips.
      nowKst: kstTime(nowMs),
      dong: this.users.getAddressDong(ctx.userId),
      weather,
    };
  }
}
