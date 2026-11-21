'use client';

import { type DragonSpecies, formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import { Egg } from '../../dragon/Egg';
import styles from './FrozenPanel.module.css';

export interface FrozenPanelProps {
  /** aokrw still in the dragon's pocket. */
  readonly pocket: bigint;
  /** Which egg sleeps (D-20). */
  readonly species: DragonSpecies;
  /** Taking the pocket back moves money: the parent does it, only from this button. */
  readonly onRefund: () => void;
  readonly onWake: () => void;
  /** While the pocket is coming back: the button spins and does not start again. */
  readonly refunding?: boolean;
}

/** Draws the sleeping dragon (an egg with Zz), take back and wake buttons (FrozenPanel.md). */
export function FrozenPanel({
  pocket,
  species,
  onRefund,
  onWake,
  refunding = false,
}: FrozenPanelProps) {
  const hasPocket = pocket > 0n;
  return (
    <div className={styles.panel}>
      <div className={styles.sleep}>
        {/* size.eggSleeping 168 (tokens.json); a test keeps them equal. */}
        <Egg state="sleeping" species={species} size={168} />
        <div className={styles.heading}>
          <h1 className={styles.title}>용이가 자고 있어요</h1>
          <p className={styles.subtitle}>모든 주문이 멈췄어요</p>
        </div>
      </div>
      <div className={styles.pocketRow}>
        <div className={styles.pocket}>
          <span className={styles.pocketLabel}>용이 주머니</span>
          <span className={styles.pocketLeft}>{formatOkrw(pocket)} 남음</span>
        </div>
        {hasPocket ? (
          <Button variant="outline" size="md" loading={refunding} onPress={onRefund}>
            돌려받기
          </Button>
        ) : null}
      </div>
      <Button variant="primary" onPress={onWake}>
        용이 깨우기
      </Button>
    </div>
  );
}
