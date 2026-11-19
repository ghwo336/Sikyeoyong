'use client';

import { type ReactNode, useId } from 'react';
import styles from './ListRow.module.css';

export type ListRowTone = 'default' | 'accent';

export interface ListRowProps {
  /** Row name ("한 번에 쓸 수 있는 돈"). */
  readonly label: string;
  /** Already formatted by the parent (formatOkrw); the row does no math. */
  readonly value?: ReactNode;
  /** accent: leaf, 600 ("이번 달 아낀 돈"). Default secondary ink. */
  readonly tone?: ListRowTone;
  /**
   * 'chevron' draws the arrow. A function gets the label id, so a Switch can use it
   * as its name. Anything else is drawn as is. None keeps a 16px gap so values line up.
   */
  // 'chevron' is a string, so ReactNode already covers it in the type.
  readonly trailing?: ReactNode | ((labelId: string) => ReactNode);
  /** With it the whole row is a button; without it the row is plain. */
  readonly onPress?: () => void;
}

function Chevron() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** Draws one settings row: name, value, then an arrow or a control (ListRow.md). */
export function ListRow({ label, value, tone = 'default', trailing, onPress }: ListRowProps) {
  const labelId = useId();
  let end: ReactNode;
  if (trailing === 'chevron') end = <Chevron />;
  else if (typeof trailing === 'function') end = trailing(labelId);
  else if (trailing === undefined || trailing === null) end = <span className={styles.gap} />;
  else end = trailing;

  const content = (
    <>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      {value !== undefined ? (
        <span className={styles.value} data-tone={tone}>
          {value}
        </span>
      ) : null}
      {end}
    </>
  );

  if (onPress) {
    return (
      <button type="button" className={`${styles.row} ${styles.pressable}`} onClick={onPress}>
        {content}
      </button>
    );
  }
  return <div className={styles.row}>{content}</div>;
}
