import type { ReactNode } from 'react';
import styles from './DetailRows.module.css';

export interface DetailRow {
  readonly label: string;
  /** Already formatted by the caller (formatOkrw, a short hash). A node so it can carry a title. */
  readonly value: ReactNode;
}

/**
 * inline: label left, value right, one pair per line (Receipt, LimitChat, Done).
 * stacked: two columns, label over a 16/600 value (IdCard).
 */
export type DetailRowsLayout = 'inline' | 'stacked';
/** caption 13px (Receipt details, IdCard labels). small 14px (Done and Receipt cards, LimitChat). */
export type DetailRowsSize = 'caption' | 'small';
/** Space between pairs: tight 8, normal 10 (size.summaryGap), loose 14 (size.limitsGap). */
export type DetailRowsGap = 'tight' | 'normal' | 'loose';
/** inline values in ink (default) or secondary ink like their labels (Done, Receipt card). */
export type DetailRowsTone = 'ink' | 'secondary';

export interface DetailRowsProps {
  readonly rows: readonly DetailRow[];
  readonly layout?: DetailRowsLayout;
  readonly size: DetailRowsSize;
  readonly gap: DetailRowsGap;
  readonly tone?: DetailRowsTone;
}

/** Draws read-only label and value pairs as a description list (DetailRows.md). */
export function DetailRows({ rows, layout = 'inline', size, gap, tone = 'ink' }: DetailRowsProps) {
  return (
    <dl
      className={`${styles.rows} ${styles[layout]} ${styles[size]} ${styles[gap]}`}
      data-tone={tone}
    >
      {rows.map((r, i) => (
        // Labels can repeat (two "30일 한도" lines); the order is fixed.
        <div key={`${String(i)}-${r.label}`} className={styles.row}>
          <dt className={styles.label}>{r.label}</dt>
          <dd className={styles.value}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
