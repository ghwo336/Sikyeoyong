'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

/** Longest we wait for the next screen before the old frame is let go (a slow route). */
const MAX_WAIT_MS = 1000;

/** Each running transition's own release: resolves its callback once the new route rendered. */
const releases = new Set<() => void>();

function releaseAll(): void {
  for (const done of [...releases]) done();
}

interface ViewTransitionDocument {
  startViewTransition?: (update: () => Promise<void>) => unknown;
}

/**
 * Runs `navigate` inside a View Transition when the browser has them and motion is allowed
 * (D-23, design-and-motion.md). Elsewhere it just navigates: same result, no cross-fade.
 * The transition ends when TransitionBridge sees the new pathname, or after MAX_WAIT_MS.
 */
export function navigateWithTransition(navigate: () => void, to?: string): void {
  const doc = document as ViewTransitionDocument;
  // jsdom (tests) has no matchMedia, so the type's "always there" is not always true.
  const match = (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
  const reduced = match ? match.call(window, '(prefers-reduced-motion: reduce)').matches : false;
  // The same path never changes the pathname, so nothing would end the transition early.
  const samePath =
    to !== undefined && new URL(to, window.location.href).pathname === window.location.pathname;
  if (!doc.startViewTransition || reduced || samePath) {
    navigate();
    return;
  }
  // A new transition replaces the one before it: let that one go first, each with its own release.
  releaseAll();
  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, MAX_WAIT_MS);
        function done() {
          clearTimeout(timer);
          releases.delete(done);
          resolve();
        }
        releases.add(done);
        navigate();
      }),
  );
}

/** Mount once in the root layout: tells a waiting view transition that the route changed. */
export function TransitionBridge() {
  const pathname = usePathname();
  useEffect(() => {
    // After paint, so the new frame is what the transition captures.
    const id = requestAnimationFrame(() => {
      releaseAll();
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [pathname]);
  return null;
}

/** The app router with push and replace that cross-fade between screens when they can. */
export function useTransitionRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (href: string) => {
        navigateWithTransition(() => {
          router.push(href);
        }, href);
      },
      replace: (href: string) => {
        navigateWithTransition(() => {
          router.replace(href);
        }, href);
      },
    }),
    [router],
  );
}
