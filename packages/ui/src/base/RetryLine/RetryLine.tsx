import { Button } from '../Button';
import { ErrorLine } from '../ErrorLine';
import styles from './RetryLine.module.css';

export interface RetryLineProps {
  /** One short line in the dragon's plain words ("주문 내역을 못 불러왔어요"). */
  readonly children: string;
  /** Asks again. */
  readonly onRetry: () => void;
  /** The press label. Default "다시 불러오기". */
  readonly retryLabel?: string;
}

/** Draws a failed read as one error line with a retry press under it (RetryLine.md). */
export function RetryLine({ children, onRetry, retryLabel = '다시 불러오기' }: RetryLineProps) {
  return (
    <div className={styles.retry} data-part="retry-line">
      <ErrorLine>{children}</ErrorLine>
      <Button variant="link" size="sm" onPress={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
