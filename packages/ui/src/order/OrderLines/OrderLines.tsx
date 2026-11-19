import { formatOkrw } from '@sikyeoyong/shared';
import styles from './OrderLines.module.css';

export interface OrderLine {
  readonly name: string;
  readonly quantity: number;
  /** aokrw for the whole line, as the server priced it. */
  readonly price: bigint;
}

/** body: 15px lines, 8 apart (Done, Receipt). row: 16px lines, 10 apart (Confirm). */
export type OrderLinesSize = 'body' | 'row';

export interface OrderLinesProps {
  readonly items: readonly OrderLine[];
  /** What the user asked the store for, without the "요청:" prefix. */
  readonly request?: string;
  readonly size: OrderLinesSize;
}

/**
 * Draws the menu lines ("돼지국밥 1개 9,000원") and the request under them (OrderLines.md).
 * Returns two siblings so the parent's gap spaces them like the rest of its block.
 */
export function OrderLines({ items, request, size }: OrderLinesProps) {
  return (
    <>
      <ul className={`${styles.lines} ${styles[size]}`}>
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
    </>
  );
}
