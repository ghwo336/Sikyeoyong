'use client';

import { useEffect, useRef } from 'react';

/**
 * Wraps a submit callback so a double tap calls it once (useSubmitLock.md).
 *
 * The second tap lands before the parent re-renders with busy=true, so `busy` alone
 * cannot stop it. The lock is a ref: the first call sets it, and it holds until a
 * render where the parent says it is not busy. A failed submit can then be pressed
 * again with the same order (D-19), but one press never calls twice.
 *
 * The parent must raise `busy` when it gets the call (confirming, refunding).
 */
export function useSubmitLock(busy: boolean, action: () => void): () => void {
  const lock = useRef(false);
  useEffect(() => {
    if (!busy) lock.current = false;
  });
  return () => {
    if (busy || lock.current) return;
    lock.current = true;
    action();
  };
}
