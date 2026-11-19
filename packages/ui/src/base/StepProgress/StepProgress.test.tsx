import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clampStep, StepProgress } from './StepProgress';
import styles from './StepProgress.module.css';

const css = readFileSync(resolve(__dirname, 'StepProgress.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const SIGNUP = ['본인 확인', '알 고르기', '예산'];
const ORDER = ['주문 접수', '조리 중', '배달 중', '도착'];

function cells() {
  return Array.from(screen.getByRole('progressbar').children);
}
const done = () => cells().map((c) => c.hasAttribute('data-done'));

describe('StepProgress (StepProgress.md 테스트 기준)', () => {
  it("names itself 'N단계 중 M단계' like the design (Name.dc.html)", () => {
    render(<StepProgress steps={SIGNUP} current={2} />);
    const bar = screen.getByRole('progressbar', { name: '3단계 중 2단계' });
    expect(bar).toHaveAttribute('aria-valuemin', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(done()).toEqual([true, true, false]);
  });

  it('fills up to and including the current step (Done: 조리 중)', () => {
    render(<StepProgress steps={ORDER} current={2} showLabels size="md" />);
    expect(screen.getByRole('progressbar', { name: '4단계 중 2단계, 조리 중' })).toBeTruthy();
    expect(done()).toEqual([true, true, false, false]);
    expect(screen.getByRole('progressbar').style.gridTemplateColumns).toMatch(
      /^repeat\(4, minmax\(0(px)?, 1fr\)\)$/,
    );
  });

  it('shows the names below with only the current one marked', () => {
    const { container } = render(<StepProgress steps={ORDER} current={3} showLabels />);
    const labels = container.querySelector(`.${styles.labels}`);
    expect(labels).toHaveAttribute('aria-hidden', 'true');
    const spans = Array.from(labels?.children ?? []);
    expect(spans.map((s) => s.textContent)).toEqual(ORDER);
    expect(spans.map((s) => s.hasAttribute('data-current'))).toEqual([false, false, true, false]);
  });

  it('has no names without showLabels', () => {
    const { container } = render(<StepProgress steps={ORDER} current={4} size="md" />);
    expect(container.querySelector(`.${styles.labels}`)).toBeNull();
    expect(done()).toEqual([true, true, true, true]);
  });

  it.each([
    [0, 1],
    [-3, 1],
    [9, 3],
    [2.7, 2],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 3],
    [Number.NEGATIVE_INFINITY, 1],
  ])('clamps current %s to step %s of 3', (current, expected) => {
    expect(clampStep(current, 3)).toBe(expected);
    render(<StepProgress steps={SIGNUP} current={current} />);
    expect(
      screen.getByRole('progressbar', { name: `3단계 중 ${String(expected)}단계` }),
    ).toBeTruthy();
    expect(done().filter(Boolean)).toHaveLength(expected);
  });

  it('keeps cells for repeated names', () => {
    render(<StepProgress steps={['확인', '확인']} current={1} />);
    expect(cells()).toHaveLength(2);
  });

  it.each(['sm', 'md'] as const)('puts only the %s size class on the root', (size) => {
    const { container } = render(<StepProgress steps={SIGNUP} current={1} size={size} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(styles[size]);
    expect(root.className).not.toContain(styles[size === 'sm' ? 'md' : 'sm']);
  });

  // Verify.dc.html 22-25 (4px, radius 2), Done.dc.html 33-41 (6px, radius 3, names 13px).
  it('matches the design values', () => {
    expect(rule('.sm')).toMatch(/--step-height:\s*var\(--size-step-sm\)/);
    expect(rule('.md')).toMatch(/--step-height:\s*var\(--size-step-md\)/);
    expect(rule('.cell')).toMatch(/height:\s*var\(--step-height\)/);
    expect(rule('.cell')).toMatch(/border-radius:\s*calc\(var\(--step-height\) \/ 2\)/);
    expect(rule('.cell')).toMatch(/background:\s*var\(--color-line\)/);
    expect(rule('.cell[data-done]')).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(rule('.cells')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(rule('.progress')).toMatch(/gap:\s*10px/);
    expect(rule('.labels')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.labels')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.labels [data-current]')).toMatch(/color:\s*var\(--color-ink\)/);
    expect(rule('.labels [data-current]')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
  });
});
