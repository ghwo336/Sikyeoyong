'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import styles from './LimitBlocked.module.css';
import { ActionPair } from '../../base/ActionPair';
import { AmountRatio } from '../../base/AmountRatio';

export interface LimitBlockedProps {
  /** aokrw the order wanted to pay. */
  readonly attempted: bigint;
  /** aokrw per-order limit now. */
  readonly limit: bigint;
  /**
   * aokrw per-order limit that lets this order through (shared perOrderLimitToFit, D-31).
   * None when even the top of the range is too small: then only "다시 고르기" shows.
   */
  readonly raiseTo?: bigint;
  /** Raising the limit is the parent's job (reauth, then order). */
  readonly onRaise: () => void;
  readonly onRepick: () => void;
}

/** Compares the amount with the limit, large, and offers raising the limit or picking again. */
export function LimitBlocked({ attempted, limit, raiseTo, onRaise, onRepick }: LimitBlockedProps) {
  const limitText = formatOkrw(limit);
  return (
    <div className={styles.blocked} data-theme="fixed">
      <p className={styles.compare}>
        <AmountRatio value={attempted} max={limit} size="blocked" suffix="까지" />
      </p>
      <ActionPair
        gap="md"
        primary={
          raiseTo !== undefined ? (
            <Button variant="primary" size="tall" onPress={onRaise}>
              {/* formatOkrw always ends in 원, so the particle is always 으로. */}
              <span className={styles.raiseMain}>
                한 번에 {formatOkrw(raiseTo)}으로 올리고 시키기
              </span>
            </Button>
          ) : undefined
        }
        secondary={
          <Button variant="secondary" size="choice" onPress={onRepick}>
            {limitText} 안에서 다시 고르기
          </Button>
        }
      />
    </div>
  );
}
