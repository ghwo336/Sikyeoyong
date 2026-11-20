import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { type CreateOrderBody, type CreateOrderResult, zCreateOrderBody } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { OrderQuoteService } from './order-quote.service.js';

/** /api/orders (tech-spec 3.2). HTTP only: the user comes from the session. */
@Controller('orders')
@UseGuards(SessionGuard)
export class OrdersController {
  constructor(private readonly quotes: OrderQuoteService) {}

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
}
