import type { ReactNode } from 'react';
import styles from './Hero.module.css';

/** md: 24 between the picture and the words (Hatch). lg: 28 (Start). */
export type HeroGap = 'md' | 'lg';

export interface HeroProps {
  /** The big picture on top (Egg, Dragon). */
  readonly art: ReactNode;
  /** The words under it, usually a ScreenTitle. */
  readonly children: ReactNode;
  readonly gap: HeroGap;
}

/** Stacks a big picture over its words in the middle of the room the screen leaves (Hero.md). */
export function Hero({ art, children, gap }: HeroProps) {
  return (
    <div className={`${styles.hero} ${styles[gap]}`}>
      {art}
      {children}
    </div>
  );
}
