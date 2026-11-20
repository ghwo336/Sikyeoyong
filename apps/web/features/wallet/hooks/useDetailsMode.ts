'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** 자세히 보기 is a device setting (user-flow 15): kept in this browser only. */
const KEY = 'sikyeoyong.details';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** [on, set]: off until the owner turns it on; off on the server render. */
export function useDetailsMode(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      // Storage blocked: the switch still moves for this page.
    }
    for (const l of listeners) l();
  }, []);
  return [on, set];
}
