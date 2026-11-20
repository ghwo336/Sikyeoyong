import type { ReactNode } from 'react';
import styles from './ActionPair.module.css';

/** Space between the two: xs 4 (Confirm), sm 6 (LimitChat card), md 8 (Cap, Blocked). */
export type ActionPairGap = 'xs' | 'sm' | 'md';

export interface ActionPairProps {
  /** The main action, a base Button. Optional: Blocked has none when no limit fits. */
  readonly primary?: ReactNode;
  /** The way out under it ("다시 고를래", "그만두기"), a base Button. */
  readonly secondary: ReactNode;
  readonly gap: ActionPairGap;
}

/** Stacks the main action over the lesser one, full width, at the screen's gap (ActionPair.md). */
export function ActionPair({ primary, secondary, gap }: ActionPairProps) {
  return (
    <div className={`${styles.pair} ${styles[gap]}`}>
      {primary}
      {secondary}
    </div>
  );
}
