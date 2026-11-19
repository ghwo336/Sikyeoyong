'use client';

import type { ReactNode } from 'react';
import { IconButton } from '../IconButton';
import styles from './TopBar.module.css';

export interface TopBarProps {
  /** Screen title next to the back button (Receipt "주문 상세", IdCard "용이 신분증"). */
  readonly title?: string;
  /** Going back is the parent's routing; no callback means no back button. */
  readonly onBack?: () => void;
  /** Name of the back button. Default "뒤로"; Done and Tracking say "대화로 돌아가기". */
  readonly backLabel?: string;
  /** Fills the rest of the bar, e.g. the sign-up StepProgress (Verify, Name, Budget). */
  readonly trailing?: ReactNode;
}

/** Draws the back button and title at the top of a screen (TopBar.md). */
export function TopBar({ title, onBack, backLabel = '뒤로', trailing }: TopBarProps) {
  // null and false mean nothing to show, like undefined.
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== false;
  return (
    <div className={styles.bar}>
      {onBack ? (
        <IconButton icon="back" label={backLabel} onPress={onBack} edge="start" />
      ) : hasTrailing ? (
        // Budget.dc.html keeps the bar aligned with a 34px spacer when there is no way back.
        <div className={styles.spacer} aria-hidden="true" />
      ) : null}
      {title !== undefined ? <h1 className={styles.title}>{title}</h1> : null}
      {hasTrailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
