import type { DragonSpecies } from '@sikyeoyong/shared';
import { Dragon } from '../../dragon/Dragon';
import styles from './TypingIndicator.module.css';

export interface TypingIndicatorProps {
  /** Which dragon sits next to the dots (D-20). */
  readonly species: DragonSpecies;
}

/**
 * The dragon is writing its answer (TypingIndicator.md): its small face and three dots where its
 * words will appear, so a slow answer feels like a chat, not a frozen screen (D-23).
 */
export function TypingIndicator({ species }: TypingIndicatorProps) {
  return (
    <div className={styles.row} role="status" aria-label="용이가 답을 쓰고 있어요">
      <Dragon mood="default" size={32} species={species} />
      <span className={styles.dots} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
}
