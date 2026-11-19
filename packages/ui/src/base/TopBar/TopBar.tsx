'use client';

import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

export interface TopBarProps {
  /** Screen title next to the back button (Receipt "주문 상세", IdCard "용이 신분증"). */
  readonly title?: string;
  /** Going back is the parent's routing; no callback means no back button. */
  readonly onBack?: () => void;
  /** Fills the rest of the bar, e.g. the sign-up StepProgress (Verify, Name, Budget). */
  readonly trailing?: ReactNode;
}

/** Draws the back button and title at the top of a screen (TopBar.md). */
export function TopBar({ title, onBack, trailing }: TopBarProps) {
  // null and false mean nothing to show, like undefined.
  const hasTrailing = trailing !== undefined && trailing !== null && trailing !== false;
  return (
    <div className={styles.bar}>
      {onBack ? (
        <button type="button" className={styles.back} aria-label="뒤로" onClick={onBack}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={styles.icon}
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : hasTrailing ? (
        // Budget.dc.html keeps the bar aligned with a 34px spacer when there is no way back.
        <div className={styles.spacer} aria-hidden="true" />
      ) : null}
      {title !== undefined ? <h1 className={styles.title}>{title}</h1> : null}
      {hasTrailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
