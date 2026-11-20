'use client';

import { useCallback, useEffect, useState } from 'react';

/** user-flow 0: an answer within this long goes straight on, no splash at all. */
export const SPLASH_DELAY_MS = 1_000;
/** Once shown, the splash stays at least this long so it never just flashes (a tap skips it). */
export const SPLASH_MIN_MS = 800;

export interface SplashTiming {
  /** Draw the splash now. */
  readonly visible: boolean;
  /** Keep the next screen back a moment longer (the splash has not been up long enough). */
  readonly holding: boolean;
  /** A tap: stop holding. */
  readonly skip: () => void;
}

/**
 * When the first-entry splash shows (Splash.dc.html, user-flow 0): nothing for the first second
 * (a quick session check goes straight on), then the splash until the answer, at least
 * SPLASH_MIN_MS once up. `known` is whether the answer is in.
 */
export function useSplashTiming(
  known: boolean,
  delayMs = SPLASH_DELAY_MS,
  minMs = SPLASH_MIN_MS,
): SplashTiming {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [released, setReleased] = useState(false);

  useEffect(() => {
    if (known || shownAt !== null) return undefined;
    const t = setTimeout(() => {
      setShownAt(Date.now());
    }, delayMs);
    return () => {
      clearTimeout(t);
    };
  }, [known, shownAt, delayMs]);

  useEffect(() => {
    if (!known || shownAt === null || released) return undefined;
    const t = setTimeout(
      () => {
        setReleased(true);
      },
      Math.max(0, shownAt + minMs - Date.now()),
    );
    return () => {
      clearTimeout(t);
    };
  }, [known, shownAt, released, minMs]);

  const skip = useCallback(() => {
    setReleased(true);
  }, []);
  return { visible: shownAt !== null, holding: shownAt !== null && !released, skip };
}
