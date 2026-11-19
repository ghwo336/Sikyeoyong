'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { motion } from 'motion/react';
import { PRESS_SCALE, PRESS_SPRING } from '../../base/press';
import { useShouldReduceMotion } from '../../base/reduced-motion';
import styles from './LimitBlocked.module.css';

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

/** "3으로", "2로": the particle after a number read in Korean (일, 이, 삼, ...). */
export function levelWithRo(level: number): string {
  // 0 ends in 십, 백, 천 or 영 (all with a final consonant); 3 삼 and 6 육 too.
  // 1 일, 7 칠, 8 팔 end in ㄹ, which takes 로.
  const last = Math.abs(Math.trunc(level)) % 10;
  return `${String(level)}${[0, 3, 6].includes(last) ? '으로' : '로'}`;
}

const PRESS = { scale: PRESS_SCALE };

/** Compares the amount with the limit, large, and offers raising the level or picking again. */
export function LimitBlocked({
  attempted,
  limit,
  nextLevel,
  onRaise,
  onRepick,
}: LimitBlockedProps) {
  const reduceMotion = useShouldReduceMotion();
  const tap = reduceMotion ? undefined : PRESS;
  const limitText = formatOkrw(limit);
  return (
    <div className={styles.blocked}>
      <p className={styles.compare}>
        <span className={styles.attempted}>{formatOkrw(attempted)}</span>{' '}
        <span className={styles.limit}>/ {limitText}까지</span>
      </p>
      <div className={styles.actions}>
        {nextLevel ? (
          <motion.button
            type="button"
            className={styles.raise}
            whileTap={tap}
            transition={PRESS_SPRING}
            onClick={onRaise}
          >
            <span className={styles.raiseMain}>
              레벨 {levelWithRo(nextLevel.level)} 올리고 시키기
            </span>{' '}
            <span className={styles.raiseSub}>한 번에 {formatOkrw(nextLevel.limit)}까지</span>
          </motion.button>
        ) : null}
        <motion.button
          type="button"
          className={styles.repick}
          whileTap={tap}
          transition={PRESS_SPRING}
          onClick={onRepick}
        >
          {limitText} 안에서 다시 고르기
        </motion.button>
      </div>
    </div>
  );
}
