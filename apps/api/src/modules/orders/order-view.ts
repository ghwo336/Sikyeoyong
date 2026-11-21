import {
  APP_ERRORS,
  APP_ERROR_CODES,
  type AppErrorCode,
  type DragonMoodKey,
  type OrderView,
  renderDragonLine,
} from '@sikyeoyong/shared';
import { parseStoredLines, toItemLines } from './order-lines.js';
import type { OrderRow } from './orders.repository.js';

/** What the view needs from other modules, read by the caller. */
export interface OrderViewContext {
  readonly store: string;
  readonly destination: string;
  readonly etaMin: number;
  /**
   * No real delivery feed yet (the delivery module): on the mock chain or in demo mode, a paid
   * order moves along by time so the status screens play out (paid, preparing, delivering,
   * delivered). The stored status stays paid.
   */
  readonly simulateDelivery?: boolean;
}

/**
 * The simulated delivery stage of a paid order: the first 15% of the way the store takes it,
 * up to 45% it cooks, then the rider until the estimated arrival, then delivered.
 */
export function deliveryStatus(
  status: OrderView['status'],
  startMs: number,
  etaMin: number,
  nowMs: number,
): OrderView['status'] {
  if (status !== 'paid') return status;
  const total = Math.max(1, etaMin) * 60_000;
  const share = (nowMs - startMs) / total;
  if (share >= 1) return 'delivered';
  if (share >= 0.45) return 'delivering';
  if (share >= 0.15) return 'preparing';
  return 'paid';
}

/** The dragon's line and face per status (Done, Tracking, Arrived designs). */
const LINE_OF: Record<Exclude<OrderView['status'], 'failed'>, [string, DragonMoodKey]> = {
  quoted: ['이대로 괜찮아용?', 'default'],
  pending_approval: ['주인님 허락을 기다려용.', 'worried'],
  submitting: ['주문 넣는 중이에용.', 'excited'],
  paid: ['주문 넣었어용.\n가게가 받으면 알려 줄게용.', 'happy'],
  preparing: ['만드는 중이에용.\n출발하면 알려 줄게용.', 'cooking'],
  delivering: ['라이더님 출발했어용!\n숟가락 준비해용.', 'excited'],
  delivered: ['도착했어용. 맛있게 먹어용!', 'eating'],
  cancelled: ['주문이 취소됐어용. 돈은 돌려받아용.', 'worried'],
  refunded: ['돈은 돌려받았어용.', 'default'],
};

const MAX_MIN = 24 * 60;

function asCode(value: string | null): AppErrorCode | null {
  return value !== null && (APP_ERROR_CODES as readonly string[]).includes(value)
    ? (value as AppErrorCode)
    : null;
}

/** A failed order speaks its error's line; a line that needs a value it no longer has falls back to the message. */
function failedLine(code: AppErrorCode | null): string {
  if (code === null) return APP_ERRORS.INTERNAL.message;
  try {
    return renderDragonLine(code);
  } catch {
    return APP_ERRORS[code].message;
  }
}

/**
 * GET /orders/:id and confirm answer this (OrderView). The arrival time counts
 * from when paying started (the confirm press), else from the quote.
 */
export function toOrderView(row: OrderRow, ctx: OrderViewContext, nowMs: number): OrderView {
  const startMs = row.submitStartedAt ?? row.createdAt;
  const etaAt = startMs + ctx.etaMin * 60_000;
  const remainingMin = Math.min(MAX_MIN, Math.max(0, Math.ceil((etaAt - nowMs) / 60_000)));
  const code = asCode(row.errorCode);
  const status =
    ctx.simulateDelivery === true
      ? deliveryStatus(row.status, startMs, ctx.etaMin, nowMs)
      : row.status;
  const [dragonLine, dragonMood] =
    status === 'failed' ? [failedLine(code), 'worried' as const] : LINE_OF[status];
  return {
    id: row.id,
    status,
    store: ctx.store,
    destination: ctx.destination,
    items: toItemLines(parseStoredLines(row.itemsJson)),
    ...(row.note === null ? {} : { request: row.note }),
    amount: row.amountAokrw,
    etaAt,
    remainingMin,
    dragonLine,
    dragonMood,
    ...(status === 'failed' && code !== null ? { errorCode: code } : {}),
    ...(row.txHash === null ? {} : { txHash: row.txHash }),
    ...(row.perOrderLimitAtQuote === null || row.periodCapAtQuote === null
      ? {}
      : {
          limitsAtOrder: {
            perOrderLimit: row.perOrderLimitAtQuote,
            periodCap: row.periodCapAtQuote,
          },
        }),
  };
}
