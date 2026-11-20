import { AppError, formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import type { ApprovalRequestOutcome, QuoteOutcome } from '../../orders/orders.service.js';
import { ApprovalWait, ToolReply } from './tool-reply.js';

const won = (aokrw: string) => formatOkrw(parseAokrw(aokrw));

/**
 * What the model hears about an order waiting for the owner, in plain data: nothing is
 * paid or ordered, no card is up, and the owner has not decided. The runtime shows no
 * model words after this; the server says the wait (agent-runtime.md "허락 대기").
 */
const WAITING = {
  paid: false,
  ordered: false,
  confirmCardShown: false,
  ownerDecision: 'NOT_DECIDED_YET',
  next: '주인님은 아직 허락하지 않았다. 허락에 대한 말은 서버가 한다. 승인됐다, 허락받았다, 카드를 띄웠다고 말하지 않는다.',
} as const;

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
  if (result.order.status === 'pending_approval' && approvalReason !== null) {
    return new ApprovalWait(
      { status: 'APPROVAL_REQUIRED', ...WAITING, reason: approvalReason },
      approvalReason,
    );
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
  return new ApprovalWait(
    { status: 'APPROVAL_REQUESTED', ...WAITING, reason: outcome.reason },
    outcome.reason,
  );
}
