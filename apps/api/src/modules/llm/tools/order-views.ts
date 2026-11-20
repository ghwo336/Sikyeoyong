import { AppError, formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import type { QuoteOutcome } from '../../orders/orders.service.js';
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
