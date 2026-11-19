import { renderHook } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useShouldReduceMotion } from './reduced-motion';

const withConfig = (reducedMotion: 'always' | 'never' | 'user') =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
  };

describe('useShouldReduceMotion', () => {
  it('is false by default in a test environment without the device setting', () => {
    expect(renderHook(() => useShouldReduceMotion()).result.current).toBe(false);
  });

  it('is true under <MotionConfig reducedMotion="always">', () => {
    expect(
      renderHook(() => useShouldReduceMotion(), { wrapper: withConfig('always') }).result.current,
    ).toBe(true);
  });

  it('stays false under "never" when the device setting is off', () => {
    expect(
      renderHook(() => useShouldReduceMotion(), { wrapper: withConfig('never') }).result.current,
    ).toBe(false);
  });
});
