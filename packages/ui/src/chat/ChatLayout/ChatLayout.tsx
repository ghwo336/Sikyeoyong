'use client';

import type { ReactNode } from 'react';
import styles from './ChatLayout.module.css';
import { useKeyboardInset } from '../../base/useKeyboardInset';

export interface ChatLayoutProps {
  /** Top row, usually ChatHeader. */
  readonly header?: ReactNode;
  /** Under the top row, e.g. the month's budget Meter (Main). */
  readonly top?: ReactNode;
  /** The messages, usually ChatThread. It takes the height that is left and scrolls. */
  readonly children: ReactNode;
  /** The input at the bottom, usually ChatInput. */
  readonly footer: ReactNode;
}

/** Lays out the chat screen's bands: top row, budget, messages, input (ChatLayout.md). */
export function ChatLayout({ header, top, children, footer }: ChatLayoutProps) {
  // The keyboard covers the bottom of the screen on iOS: lift the input band above it.
  const inset = useKeyboardInset();
  return (
    <div
      className={styles.layout}
      style={inset > 0 ? { paddingBottom: inset } : undefined}
      data-keyboard={inset > 0 ? '' : undefined}
    >
      {header !== undefined && header !== null ? (
        <div className={styles.header}>{header}</div>
      ) : null}
      {top !== undefined && top !== null ? <div className={styles.top}>{top}</div> : null}
      {children}
      <div className={styles.footer}>{footer}</div>
    </div>
  );
}
