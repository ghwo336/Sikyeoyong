import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Amount } from './Amount';

// motion caches the device preference on first use, so the hook is controlled here.
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => reduced.value };
});

// verify-allow: R4 independent oracle for expected values, not production code
const won = (n: bigint) => n * 10n ** 18n;

afterEach(() => {
  reduced.value = false;
});

describe('Amount (Amount.md 테스트 기준)', () => {
  it.each([
    [won(9_000n), '9,000원'],
    [won(45_000n), '45,000원'],
    [won(1_234_567n), '1,234,567원'],
    [0n, '0원'],
  ])('shows the same text as formatOkrw when static (%s)', (value, text) => {
    const { container } = render(<Amount value={value} size="row" />);
    expect(container.textContent).toBe(text);
  });

  it('reads the formatted amount once to screen readers when rolling', () => {
    const { container } = render(<Amount value={won(45_000n)} size="display" animate />);
    expect(screen.getByText('45,000원')).toBeInTheDocument();
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).not.toBeNull();
    // five digit windows, each holding the ten digits 0-9
    expect(hidden?.querySelectorAll('.window')).toHaveLength(5);
    expect(hidden?.querySelectorAll('.cell')).toHaveLength(50);
    expect(Array.from(hidden?.querySelectorAll('.static') ?? []).map((n) => n.textContent)).toEqual(
      [',', '원'],
    );
  });

  it('does not roll under reduced motion: plain text only', () => {
    reduced.value = true;
    const { container } = render(<Amount value={won(45_000n)} size="display" animate />);
    expect(container.textContent).toBe('45,000원');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('updates the text when the value changes', () => {
    const { rerender } = render(<Amount value={won(9_000n)} size="title" animate />);
    act(() => {
      rerender(<Amount value={won(10_500n)} size="title" animate />);
    });
    expect(screen.getByText('10,500원')).toBeInTheDocument();
    expect(screen.queryByText('9,000원')).toBeNull();
  });

  it.each(['display', 'title', 'row'] as const)('applies the %s size class', (size) => {
    const { container } = render(<Amount value={won(1n)} size={size} />);
    expect(container.firstElementChild?.className).toContain(size);
  });
});
