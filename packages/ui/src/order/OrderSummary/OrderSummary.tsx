import { formatOkrw } from '@sikyeoyong/shared';
import { DetailRows } from '../../base/DetailRows';
import { type OrderLine, OrderLines } from '../OrderLines';
import styles from './OrderSummary.module.css';

// The line type lives with OrderLines; re-exported so callers keep importing it from here.
export type { OrderLine } from '../OrderLines';

export interface OrderDetail {
  readonly label: string;
  /** Already formatted by the parent ("용이 용돈", "9,000 / 10,000원"). */
  readonly value: string;
}

export interface OrderSummaryProps {
  /** Top line ("마루국밥 본점에서 회사(역삼동)로", or the store name on Receipt). */
  readonly store: string;
  /** Right end of the top line (Receipt: "12월 9일 12시 31분"). */
  readonly when?: string;
  readonly items: readonly OrderLine[];
  /** What the user asked the store for, without the "요청:" prefix. */
  readonly request?: string;
  /** aokrw total from the server. Shown as is, never summed here. */
  readonly total: bigint;
  /** Small rows under the total (Receipt: 결제 수단, 한 번에 쓸 수 있는 돈, 30일 한도). */
  readonly details?: readonly OrderDetail[];
}

/** Draws the store, menu, request and the amount paid (OrderSummary.md). */
export function OrderSummary({ store, when, items, request, total, details }: OrderSummaryProps) {
  return (
    <section className={styles.card} aria-label="주문 내용">
      <div className={styles.head}>
        <span>{store}</span>
        {when !== undefined ? <span className={styles.num}>{when}</span> : null}
      </div>
      <OrderLines items={items} request={request} size="body" />
      <div className={styles.divider} aria-hidden="true" />
      <div className={styles.total}>
        <span className={styles.totalLabel}>결제한 금액</span>
        <span className={`${styles.totalAmount} ${styles.num}`}>{formatOkrw(total)}</span>
      </div>
      {details && details.length > 0 ? (
        <DetailRows rows={details} size="small" gap="tight" tone="secondary" />
      ) : null}
    </section>
  );
}
