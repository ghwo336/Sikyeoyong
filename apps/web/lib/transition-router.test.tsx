import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();
let pathname = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname,
}));

const { navigateWithTransition, TransitionBridge } = await import('./transition-router');

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (document as { startViewTransition?: unknown }).startViewTransition;
  push.mockReset();
  vi.useRealTimers();
});

describe('navigateWithTransition (D-23 View Transitions)', () => {
  it('just navigates when the browser has no View Transitions', () => {
    setReducedMotion(false);
    const go = vi.fn();
    navigateWithTransition(go);
    expect(go).toHaveBeenCalledOnce();
  });

  it('just navigates under reduced motion, even when the API exists', () => {
    setReducedMotion(true);
    const start = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    const go = vi.fn();
    navigateWithTransition(go);
    expect(start).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledOnce();
  });

  it('navigates inside the transition and lets go when the pathname changes', async () => {
    setReducedMotion(false);
    let settled = false;
    (document as { startViewTransition?: unknown }).startViewTransition = (
      update: () => Promise<void>,
    ) => {
      void update().then(() => {
        settled = true;
      });
    };
    const go = vi.fn();
    const view = render(<TransitionBridge />);
    navigateWithTransition(go);
    expect(go).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(settled).toBe(false);
    pathname = '/orders';
    view.rerender(<TransitionBridge />);
    await act(async () => {
      await new Promise((r) => {
        requestAnimationFrame(() => {
          r(undefined);
        });
      });
    });
    expect(settled).toBe(true);
  });

  it('lets go after the wait limit when the route never changes', async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    let settled = false;
    (document as { startViewTransition?: unknown }).startViewTransition = (
      update: () => Promise<void>,
    ) => {
      void update().then(() => {
        settled = true;
      });
    };
    navigateWithTransition(() => undefined);
    await vi.advanceTimersByTimeAsync(1100);
    expect(settled).toBe(true);
  });

  it('does not start a transition for the pathname it is already on', () => {
    setReducedMotion(false);
    const start = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    const go = vi.fn();
    navigateWithTransition(go, window.location.pathname + '?tab=1#x');
    expect(start).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledOnce();
    navigateWithTransition(go, '/somewhere-else');
    expect(start).toHaveBeenCalledOnce();
  });

  it('keeps one release per transition: a newer one does not strand the older', async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const settled: number[] = [];
    let n = 0;
    (document as { startViewTransition?: unknown }).startViewTransition = (
      update: () => Promise<void>,
    ) => {
      const id = ++n;
      void update().then(() => settled.push(id));
    };
    navigateWithTransition(() => undefined, '/a');
    navigateWithTransition(() => undefined, '/b');
    await vi.advanceTimersByTimeAsync(0);
    // The first is let go when the second starts, long before its own 1 s limit.
    expect(settled).toEqual([1]);
    const view = render(<TransitionBridge />);
    pathname = '/changed';
    view.rerender(<TransitionBridge />);
    await vi.advanceTimersByTimeAsync(50);
    expect(settled).toEqual([1, 2]);
  });
});
