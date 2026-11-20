import type { ReactNode } from 'react';
import type { DragonMood } from './Dragon';
import styles from './Dragon.module.css';

// Things around the dragon that come with a mood or a growth stage: Zz, sweat, steam, the bowl, wings.

/** Zz while sleeping, a sweat drop when worried or hiding, steam while cooking. */
export function Extras({ mood }: { mood: DragonMood }): ReactNode {
  switch (mood) {
    case 'sleeping':
      return (
        <g data-part="zz">
          <path className={styles.zz} d="M46 12 H52 L46 18 H52" />
          <path className={styles.zzSmall} d="M54 4 H58 L54 8 H58" />
        </g>
      );
    case 'worried':
    case 'hiding':
      return (
        <path
          data-part="sweat"
          className={styles.sweat}
          d="M47 18 C49 21 50 22.5 50 24 A3 3 0 0 1 44 24 C44 22.5 45 21 47 18 Z"
        />
      );
    case 'cooking':
      return (
        <g data-part="steam">
          <path className={styles.steam} d="M27 12 Q29 8 27 4" />
          <path className={styles.steam} d="M33 11 Q35 7 33 3" />
        </g>
      );
    default:
      return null;
  }
}

/** Eating: a bowl in front of the shell. */
export function Bowl(): ReactNode {
  return (
    <g data-part="bowl">
      <path className={styles.line} d="M24 50 C24 44 40 44 40 50" />
      <rect className={styles.bowl} x="20" y="44" width="24" height="9" rx="3" />
      <path className={styles.steam} d="M26 48.5 H38" />
    </g>
  );
}

/** Stage 3 (dragonStage) grows wings behind the head (Dragon.md). */
export function Wings(): ReactNode {
  return (
    <g data-part="wings">
      <path className={styles.body} d="M10 24 C4 20 4 12 8 10 C10 16 14 18 18 20 Z" />
      <path className={styles.body} d="M54 24 C60 20 60 12 56 10 C54 16 50 18 46 20 Z" />
    </g>
  );
}
