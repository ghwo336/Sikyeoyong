'use client';

import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Sheet.module.css';

export type SheetSnap = 'content' | 'full';

export interface SheetProps {
  readonly open: boolean;
  /** Esc, a press outside, or a drag down asks the parent to close. */
  readonly onClose: () => void;
  /** Dialog name read by screen readers (Confirm.dc.html "주문 확인"). */
  readonly label: string;
  readonly children: ReactNode;
  /** content: as tall as the content (scrolls past the top gap). full: always full height. */
  readonly snap?: SheetSnap;
}

// tokens.json motion.sheet: "spring damping 22, 300ms".
export const SHEET_SPRING = { type: 'spring', damping: 22, stiffness: 300 } as const;
const FADE = { duration: 0.2 } as const;
/** Drag down past this many px, or fling faster than this, to close. */
export const CLOSE_OFFSET = 120;
export const CLOSE_VELOCITY = 500;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function shouldClose(info: Pick<PanInfo, 'offset' | 'velocity'>): boolean {
  return info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY;
}

/** Draws the bottom sheet frame and handle; the content is children (Sheet.md). */
export function Sheet({ open, onClose, label, children, snap = 'content' }: SheetProps) {
  const reduceMotion = useShouldReduceMotion();
  const panel = useRef<HTMLDivElement>(null);

  // Move focus in on open and give it back on close.
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    return () => {
      before?.focus();
    };
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: FADE }
    : {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: SHEET_SPRING,
      };

  return (
    <AnimatePresence>
      {open ? (
        <div className={styles.layer} key="sheet">
          <motion.div
            className={styles.scrim}
            data-part="scrim"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={`${styles.panel} ${styles[snap]}`}
            onKeyDown={onKeyDown}
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={(_, info) => {
              if (shouldClose(info)) onClose();
            }}
            {...slide}
          >
            <div className={styles.handle} aria-hidden="true" />
            <div className={styles.body}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
