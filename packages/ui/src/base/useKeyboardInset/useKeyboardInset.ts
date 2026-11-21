'use client';

import { useEffect, useState } from 'react';

/**
 * How many CSS pixels of the layout viewport the on-screen keyboard covers (0 when it is
 * closed or the browser has no visualViewport). iOS Safari keeps the layout viewport full
 * height when the keyboard opens, so a bottom band must lift itself by this much.
 */
export function keyboardInset(): number {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  // innerHeight is the layout viewport; the visual one shrinks (and may scroll) under the keyboard.
  const covered = window.innerHeight - vv.height - vv.offsetTop;
  return Math.max(0, Math.round(covered));
}

/** Follows the keyboard's height through visualViewport resize and scroll events. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setInset(keyboardInset());
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
