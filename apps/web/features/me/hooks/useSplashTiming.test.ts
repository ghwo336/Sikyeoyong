import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPLASH_DELAY_MS, SPLASH_MIN_MS, useSplashTiming } from './useSplashTiming';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useSplashTiming (user-flow 0)', () => {
  it('uses the user-flow numbers: nothing for the first second, then at least 0.8s', () => {
    expect(SPLASH_DELAY_MS).toBe(1_000);
    expect(SPLASH_MIN_MS).toBe(800);
  });

  it('an answer within a second never shows the splash and holds nothing', () => {
    const { result, rerender } = renderHook(({ known }) => useSplashTiming(known), {
      initialProps: { known: false },
    });
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current.visible).toBe(false);
    rerender({ known: true });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toMatchObject({ visible: false, holding: false });
  });

  it('a slow answer shows the splash after a second and keeps it up at least 0.8s', () => {
    const { result, rerender } = renderHook(({ known }) => useSplashTiming(known), {
      initialProps: { known: false },
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toMatchObject({ visible: true, holding: true });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ known: true });
    expect(result.current.holding).toBe(true);
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(result.current.holding).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.holding).toBe(false);
  });

  it('a long wait lets go as soon as the answer comes', () => {
    const { result, rerender } = renderHook(({ known }) => useSplashTiming(known), {
      initialProps: { known: false },
    });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    rerender({ known: true });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.holding).toBe(false);
  });

  it('a tap stops holding at once', () => {
    const { result, rerender } = renderHook(({ known }) => useSplashTiming(known), {
      initialProps: { known: false },
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    rerender({ known: true });
    act(() => {
      result.current.skip();
    });
    expect(result.current.holding).toBe(false);
  });
});
