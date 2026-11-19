'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';
import styles from './ChatThread.module.css';

export interface ChatThreadProps {
  /** Messages top to bottom (UserBubble, DragonLine, cards). */
  readonly children: ReactNode;
  /** Keep the newest message in view. Stops while the user has scrolled up. Default true. */
  readonly autoScroll?: boolean;
  /** Time stamp above the messages ("오늘 오후 12:28"). */
  readonly stamp?: string;
  /** While the dragon is still writing its answer. */
  readonly streaming?: boolean;
}

/** Within this many px of the bottom still counts as "at the bottom". */
export const PIN_SLACK = 24;

export function isNearBottom(el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_SLACK;
}

/** Stacks chat messages top to bottom and follows new ones (ChatThread.md). */
export function ChatThread({
  children,
  autoScroll = true,
  stamp,
  streaming = false,
}: ChatThreadProps) {
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Runs after every render, so streamed text growing a message also follows.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !autoScroll || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  });

  return (
    <div
      ref={box}
      className={styles.thread}
      role="log"
      aria-live="polite"
      aria-busy={streaming || undefined}
      onScroll={(e) => {
        pinned.current = isNearBottom(e.currentTarget);
      }}
    >
      {stamp !== undefined ? <p className={styles.stamp}>{stamp}</p> : null}
      {children}
    </div>
  );
}
