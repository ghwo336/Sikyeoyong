import { AppError, formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import type { ApprovalRequestOutcome, QuoteOutcome } from '../../orders/orders.service.js';
import { ToolReply } from './tool-reply.js';

const won = (aokrw: string) => formatOkrw(parseAokrw(aokrw));

/**
 * place_order's two faces (agent-runtime.md "모델용과 화면용"). A quote goes to the
 * screen as the confirm card; the model hears only that a card is up, in display
 * words, and that nothing is paid until the user presses its button (CLAUDE.md
 * rule 3). An order that needs the owner returns APPROVAL_REQUIRED with the
 * reason and no card (tech-spec 1.4 flow 3).
 */
export function placeOrderReply(outcome: QuoteOutcome): unknown {
  const { result, approvalReason } = outcome;
  const quote = result.quote;
  if (result.order.status === 'quoted' && quote !== undefined) {
    return new ToolReply(
      {
        status: 'CONFIRM_CARD_SHOWN',
        paid: false,
        store: quote.store,
        items: quote.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: won(i.price),
        })),
        amount: won(quote.amount),
        etaMin: quote.etaMin,
        next: '사용자가 카드의 버튼을 눌러야 결제된다',
      },
      { type: 'order_confirm', quote },
    );
  }
  if (result.order.status === 'pending_approval') {
    return { status: 'APPROVAL_REQUIRED', paid: false, reason: approvalReason };
  }
  // place_order sends no clientOrderId, so it never resends: any other state is a server bug.
  throw new AppError('INTERNAL', { reason: 'place_order quote in an unexpected state' });
}

/**
 * request_owner_approval's answer. The reason is the server's (the model's guess is
 * not trusted); nothing is paid or approved here, and no card is shown. If the
 * server's rules need no owner, no order is made: the model is told to use place_order.
 */
export function approvalRequestReply(outcome: ApprovalRequestOutcome): unknown {
  if (outcome.kind === 'not_needed') {
    return { status: 'NO_APPROVAL_NEEDED', paid: false, next: 'place_order로 확인 카드를 띄운다' };
  }
  return { status: 'APPROVAL_REQUESTED', paid: false, reason: outcome.reason };
}
