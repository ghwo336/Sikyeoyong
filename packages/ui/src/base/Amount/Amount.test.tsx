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

  // What the eye sees: the cell sitting at each column's offset (translateY(-N em) shows cell N).
  const visible = (root: HTMLElement) =>
    Array.from(root.querySelectorAll<HTMLElement>('.column')).map((c) => {
      const m = /translateY\((-?\d+)em\)/.exec(c.style.transform);
      const index = m ? -Number(m[1]) : 0;
      return c.children[index]?.textContent ?? '?';
    });

  it.each([
    [won(45_000n), ['4', '5', '0', '0', '0']],
    [won(1_234_567n), ['1', '2', '3', '4', '5', '6', '7']],
    [won(9_080n), ['9', '0', '8', '0']],
  ])('shows the right digit in every window (%s)', (value, expected) => {
    const { container } = render(<Amount value={value} size="display" animate />);
    expect(visible(container)).toEqual(expected);
  });

  it('rolls each window to the new digit and keeps the ones column node', async () => {
    const { container, rerender } = render(<Amount value={won(9_000n)} size="title" animate />);
    const onesBefore = container.querySelectorAll('.column')[3];
    act(() => {
      rerender(<Amount value={won(10_500n)} size="title" animate />);
    });
    expect(screen.getByText('10,500원')).toBeInTheDocument();
    expect(screen.queryByText('9,000원')).toBeNull();
    // keyed from the right: the ones column is the same DOM node after the length changes
    expect(container.querySelectorAll('.column')[4]).toBe(onesBefore);
    await waitFor(
      () => {
        expect(visible(container)).toEqual(['1', '0', '5', '0', '0']);
      },
      { timeout: 2000 },
    );
  });

  it.each(['display', 'title', 'row', 'inherit'] as const)('applies the %s size class', (size) => {
    const { container } = render(<Amount value={won(1n)} size={size} />);
    expect(container.firstElementChild?.className).toContain(size);
  });

  it('drops the trailing 원 only when asked, still through formatOkrw', () => {
    const { container, rerender } = render(<Amount value={won(210_000n)} size="inherit" />);
    expect(container.textContent).toBe('210,000원');
    rerender(<Amount value={won(210_000n)} size="inherit" unit={false} />);
    expect(container.textContent).toBe('210,000');
    rerender(<Amount value={won(123_456_789_012_345_678n)} size="inherit" unit={false} />);
    expect(container.textContent).toBe('123,456,789,012,345,678');
  });
});
