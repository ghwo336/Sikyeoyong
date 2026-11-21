import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  type CreateOrderBody,
  type CreateOrderResult,
  type OpenQuoteResult,
  type OrderList,
  type OrderResult,
  type RateOrderBody,
  zCreateOrderBody,
  zOrderIdParam,
  zRateOrderBody,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import {
  UserRateLimitGuard,
  UserRateLimited,
} from '../../common/rate-limit/user-rate-limit.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { OrderConfirmService } from './order-confirm.service.js';
import { OrderQuoteService } from './order-quote.service.js';
import { OrderRatingService } from './order-rating.service.js';
import { OrderRequoteService } from './order-requote.service.js';
import { OrderViews } from './order-views.service.js';

/** /api/orders (tech-spec 3.2). HTTP only: the user comes from the session. */
@Controller('orders')
@UseGuards(SessionGuard, UserRateLimitGuard)
export class OrdersController {
  constructor(
    private readonly quotes: OrderQuoteService,
    private readonly confirms: OrderConfirmService,
    private readonly views: OrderViews,
    private readonly ratings: OrderRatingService,
    private readonly requotes: OrderRequoteService,
  ) {}

  /** A quote for the app's own order button. Never pays (CLAUDE.md rule 3). */
  @Post()
  @HttpCode(200)
  @UserRateLimited('order')
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zCreateOrderBody)) body: CreateOrderBody,
  ): Promise<CreateOrderResult> {
    return this.quotes
      .create(user.userId, {
        merchantId: body.merchantId,
        items: body.items,
        clientOrderId: body.clientOrderId,
      })
      .then((o) => o.result);
  }

  /** The card's button. The only call that pays (CLAUDE.md rule 3, payment.md "confirm 상태 규칙"). */
  @Post(':id/confirm')
  @HttpCode(200)
  @UserRateLimited('orderStep')
  confirm(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zOrderIdParam)) id: string,
  ): Promise<OrderResult> {
    return this.confirms.confirm(user.userId, id);
  }

  /**
   * After the owner raised the per-order limit (Blocked, user-flow 12): the order that waited
   * for it, quoted again with its confirm card. Never pays (CLAUDE.md rule 3).
   */
  @Post(':id/requote')
  @HttpCode(200)
  @UserRateLimited('orderStep')
  requote(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zOrderIdParam)) id: string,
  ): Promise<CreateOrderResult> {
    return this.requotes.requote(user.userId, id);
  }

  /** Arrived screen taste rating. Moves no money. */
  @Post(':id/rating')
  @HttpCode(204)
  @UserRateLimited('rating')
  rate(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zOrderIdParam)) id: string,
    @Body(new ZodValidationPipe(zRateOrderBody)) body: RateOrderBody,
  ): void {
    this.ratings.rate(user.userId, id, body.value);
  }

  /** Recent orders (Main's order history and in-progress card). Reads only. */
  @Get()
  list(@CurrentUser() user: SessionUser): OrderList {
    return { orders: this.views.listFor(user.userId) };
  }

  /** The confirm card to bring back after a reload. Reads only; declared before :id. */
  @Get('open-quote')
  async openQuote(@CurrentUser() user: SessionUser): Promise<OpenQuoteResult> {
    const quote = await this.quotes.openQuote(user.userId);
    return quote === undefined ? {} : { quote };
  }

  /** The status screens (Done, Tracking, Arrived). Reads only. */
  @Get(':id')
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zOrderIdParam)) id: string,
  ): OrderResult {
    return { order: this.views.viewFor(user.userId, id) };
  }
}
