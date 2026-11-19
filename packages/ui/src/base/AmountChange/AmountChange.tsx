import { Amount } from '../Amount';
import { Icon } from '../Icon';
import styles from './AmountChange.module.css';

export interface AmountChangeProps {
  /** aokrw before, struck through. */
  readonly from: bigint;
  /** aokrw after, large. */
  readonly to: bigint;
  /** Roll the new amount when it changes. Default false. */
  readonly animate?: boolean;
}

/** Draws "before -> after" for one amount, read aloud as "A에서 B으로" (AmountChange.md). */
export function AmountChange({ from, to, animate = false }: AmountChangeProps) {
  return (
    <span className={styles.change}>
      <s className={styles.from}>
        <Amount value={from} size="inherit" />
      </s>
      <Icon name="arrow-right" className={styles.arrow} />
      <span className={styles.srOnly}>에서</span>
      <b className={styles.to}>
        <Amount value={to} size="inherit" animate={animate} />
      </b>
      <span className={styles.srOnly}>으로</span>
    </span>
  );
}
