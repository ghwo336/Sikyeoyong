'use client';

import { formatOkrw, levelWithRo } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import styles from './LimitBlocked.module.css';
import { ActionPair } from '../../base/ActionPair';

export interface NextLevel {
  readonly level: number;
  /** aokrw per-order limit at that level. */
  readonly limit: bigint;
}

export interface LimitBlockedProps {
  /** aokrw the order wanted to pay. */
  readonly attempted: bigint;
  /** aokrw per-order limit now. */
  readonly limit: bigint;
  /** The next level up; none at the top level. */
  readonly nextLevel?: NextLevel;
  /** Raising the level is the parent's job (reauth, then order). */
  readonly onRaise: () => void;
  readonly onRepick: () => void;
}

// The particle helper is shared (packages/shared text/korean); re-exported for older imports.
export { levelWithRo };

/** Compares the amount with the limit, large, and offers raising the level or picking again. */
export function LimitBlocked({
  attempted,
  limit,
  nextLevel,
  onRaise,
  onRepick,
}: LimitBlockedProps) {
  const limitText = formatOkrw(limit);
  return (
    <div className={styles.blocked}>
      <p className={styles.compare}>
        <span className={styles.attempted}>{formatOkrw(attempted)}</span>{' '}
        <span className={styles.limit}>/ {limitText}까지</span>
      </p>
      <ActionPair
        gap="md"
        primary={
          nextLevel ? (
            <Button variant="primary" size="tall" onPress={onRaise}>
              <span className={styles.raiseLines}>
                <span className={styles.raiseMain}>
                  레벨 {levelWithRo(nextLevel.level)} 올리고 시키기
                </span>{' '}
                <span className={styles.raiseSub}>한 번에 {formatOkrw(nextLevel.limit)}까지</span>
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
