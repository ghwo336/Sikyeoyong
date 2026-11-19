import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Amount } from './Amount';

// The device preference is cached by motion, so the preference hook is controlled here.
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('../reduced-motion', () => ({ useShouldReduceMotion: () => reduced.value }));

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

  // What the eye sees is decided by each column's offset: digit d shows at -d em.
  const columns = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('.column')).map((c) => c.style.transform);

  it.each([
    [won(45_000n), ['translateY(-4em)', 'translateY(-5em)', 'none', 'none', 'none']],
    [
      won(1_234_567n),
      [
        'translateY(-1em)',
        'translateY(-2em)',
        'translateY(-3em)',
        'translateY(-4em)',
        'translateY(-5em)',
        'translateY(-6em)',
        'translateY(-7em)',
      ],
    ],
    [won(9_080n), ['translateY(-9em)', 'none', 'translateY(-8em)', 'none']],
  ])('shows the right digit in every window (%s)', (value, expected) => {
    const { container } = render(<Amount value={value} size="display" animate />);
    expect(columns(container)).toEqual(expected);
  });

  it('rolls each window to the new digit when the value changes', async () => {
    const { container, rerender } = render(<Amount value={won(9_000n)} size="title" animate />);
    act(() => {
      rerender(<Amount value={won(10_500n)} size="title" animate />);
    });
    expect(screen.getByText('10,500원')).toBeInTheDocument();
    expect(screen.queryByText('9,000원')).toBeNull();
    await waitFor(
      () => {
        expect(columns(container)).toEqual([
          'translateY(-1em)',
          'none',
          'translateY(-5em)',
          'none',
          'none',
        ]);
      },
      { timeout: 2000 },
    );
  });

  it.each(['display', 'title', 'row'] as const)('applies the %s size class', (size) => {
    const { container } = render(<Amount value={won(1n)} size={size} />);
    expect(container.firstElementChild?.className).toContain(size);
  });
});
