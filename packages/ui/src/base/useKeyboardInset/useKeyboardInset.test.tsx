import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { keyboardInset, useKeyboardInset } from './useKeyboardInset';

type Listener = () => void;

/** A visualViewport stand-in the test can resize, as iOS does when the keyboard opens. */
function mockViewport(height: number, offsetTop = 0) {
  const listeners = new Map<string, Set<Listener>>();
  const vv = {
    height,
    offsetTop,
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(fn));
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    },
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return {
    vv,
    fire: (type: string) => {
      listeners.get(type)?.forEach((fn) => {
        fn();
      });
    },
    count: () => (listeners.get('resize')?.size ?? 0) + (listeners.get('scroll')?.size ?? 0),
  };
}

describe('useKeyboardInset (useKeyboardInset.md 테스트 기준)', () => {
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it('is 0 without visualViewport', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    expect(keyboardInset()).toBe(0);
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('is 0 while the keyboard is closed', () => {
    mockViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('follows the keyboard height when the visual viewport shrinks and grows back', () => {
    const m = mockViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      m.vv.height = window.innerHeight - 336;
      m.fire('resize');
    });
    expect(result.current).toBe(336);
    act(() => {
      m.vv.height = window.innerHeight;
      m.fire('resize');
    });
    expect(result.current).toBe(0);
  });

  it('subtracts the scroll offset the browser adds when it pans the page', () => {
    const m = mockViewport(window.innerHeight - 300, 120);
    const { result } = renderHook(() => useKeyboardInset());
    act(() => {
      m.fire('scroll');
    });
    expect(result.current).toBe(180);
  });

  it('never goes below 0 and stops listening on unmount', () => {
    const m = mockViewport(window.innerHeight + 50);
    const { result, unmount } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
    expect(m.count()).toBe(2);
    unmount();
    expect(m.count()).toBe(0);
  });
});
