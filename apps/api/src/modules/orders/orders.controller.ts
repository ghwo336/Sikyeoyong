import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import {
  type CreateOrderBody,
  type CreateOrderResult,
  type OrderResult,
  zCreateOrderBody,
  zOrderIdParam,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { OrderConfirmService } from './order-confirm.service.js';
import { OrderQuoteService } from './order-quote.service.js';

/** /api/orders (tech-spec 3.2). HTTP only: the user comes from the session. */
@Controller('orders')
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(
    private readonly quotes: OrderQuoteService,
    private readonly confirms: OrderConfirmService,
  ) {}

  /** A quote for the app's own order button. Never pays (CLAUDE.md rule 3). */
  @Post()
  @HttpCode(200)
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zCreateOrderBody)) body: CreateOrderBody,
  ): Promise<CreateOrderResult> {
    return this.quotes.create(user.userId, {
      merchantId: body.merchantId,
      items: body.items,
      clientOrderId: body.clientOrderId,
    });
  }

  /** The card's button. The only call that pays (CLAUDE.md rule 3, payment.md "confirm 상태 규칙"). */
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zOrderIdParam)) id: string,
  ): Promise<OrderResult> {
    return this.confirms.confirm(user.userId, id);
  }
}
