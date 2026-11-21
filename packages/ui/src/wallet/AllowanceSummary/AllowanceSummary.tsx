import { formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import { RetryLine } from '../../base/RetryLine';
import { Skeleton } from '../../base/Skeleton';
import styles from './AllowanceSummary.module.css';

export interface AllowanceSummaryProps {
  /** aokrw the owner has (주인님 용돈). */
  readonly owner: bigint;
  /** aokrw already in the dragon's pocket for orders. */
  readonly pocket: bigint;
  /** Topping up is the parent's job (it moves money, so never from the chat). */
  readonly onTopUp: () => void;
  /** Balances still loading: grey bars, no numbers. */
  readonly loading?: boolean;
  /** The balances could not be read: the amounts slot says so with a retry, no numbers, no top-up. */
  readonly onRetry?: () => void;
}

/** Draws the owner's allowance, the dragon's pocket and the top-up button. No addresses. */
export function AllowanceSummary({
  owner,
  pocket,
  onTopUp,
  loading = false,
  onRetry,
}: AllowanceSummaryProps) {
  return (
    <div className={styles.summary}>
      <div className={styles.amounts} aria-busy={loading || undefined}>
        <span className={styles.label}>주인님 용돈</span>
        {onRetry ? (
          <RetryLine onRetry={onRetry}>용돈을 못 불러왔어요</RetryLine>
        ) : loading ? (
          <>
            {/* About the length of "81,000원" and its line, in em of the amounts block. */}
            <Skeleton height="walletAmount" width="10em" data-part="skeleton" />
            <Skeleton height="caption" width="7.5em" data-part="skeleton" />
          </>
        ) : (
          <>
            <span className={styles.owner}>{formatOkrw(owner)}</span>
            <span className={styles.pocket}>용이 주머니에 {formatOkrw(pocket)}</span>
          </>
        )}
      </div>
      {/* No top-up before the balances are known (loading or failed). */}
      {onRetry ? null : (
        <Button variant="primary" size="md" loading={loading} onPress={onTopUp}>
          채우기
        </Button>
      )}
    </div>
  );
}
