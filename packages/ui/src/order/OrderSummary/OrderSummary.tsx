import { formatOkrw } from '@sikyeoyong/shared';
import styles from './OrderSummary.module.css';

export interface OrderLine {
  readonly name: string;
  readonly quantity: number;
  /** aokrw for the whole line, as the server priced it. */
  readonly price: bigint;
}

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
      <ul className={styles.lines}>
        {items.map((line, i) => (
          // Lines have no id and the order never changes.
          <li key={i} className={styles.line}>
            <span>
              {line.name} {String(line.quantity)}개
            </span>
            <span className={styles.num}>{formatOkrw(line.price)}</span>
          </li>
        ))}
      </ul>
      {request !== undefined && request !== '' ? (
        <p className={styles.request}>요청: {request}</p>
      ) : null}
      <div className={styles.divider} aria-hidden="true" />
      <div className={styles.total}>
        <span className={styles.totalLabel}>결제한 금액</span>
        <span className={`${styles.totalAmount} ${styles.num}`}>{formatOkrw(total)}</span>
      </div>
      {details && details.length > 0 ? (
        <dl className={styles.details}>
          {details.map((d) => (
            <div key={d.label} className={styles.detail}>
              <dt>{d.label}</dt>
              <dd className={styles.num}>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
