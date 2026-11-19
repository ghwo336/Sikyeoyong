import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fillBasisPoints, Meter, type MeterTone } from './Meter';
import styles from './Meter.module.css';

const css = readFileSync(resolve(__dirname, 'Meter.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const BUDGET = won(300_000n);

function fill() {
  return screen.getByRole('meter').firstElementChild as HTMLElement;
}

describe('Meter (Meter.md 테스트 기준)', () => {
  it('fills 100% when the value is over max, never more', () => {
    render(<Meter label="이번 달 배달비" value={won(320_000n)} max={BUDGET} tone="over" />);
    expect(fill().style.width).toBe('100%');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
  });

  it.each([
    [0n, '0%'],
    [90_000n, '30%'],
    [210_000n, '70%'],
    [219_000n, '73%'],
    [300_000n, '100%'],
    [1n, '0%'],
  ])('fills %s won of 300,000 as %s', (spent, width) => {
    render(<Meter label="이번 달 배달비" value={won(spent)} max={BUDGET} tone="normal" />);
    expect(fill().style.width).toBe(width);
  });

  it('keeps bigint precision below a won and handles max 0', () => {
    expect(fillBasisPoints(won(1n), won(3n))).toBe(3333);
    expect(fillBasisPoints(won(300_000n) - 1n, won(300_000n))).toBe(9999);
    expect(fillBasisPoints(0n, 0n)).toBe(0);
    expect(fillBasisPoints(1n, 0n)).toBe(10_000);
    expect(fillBasisPoints(-5n, BUDGET)).toBe(0);
    expect(fillBasisPoints(-BUDGET, BUDGET)).toBe(0);
    expect(fillBasisPoints(5n, -1n)).toBe(10_000);
    expect(fillBasisPoints(-1n, -1n)).toBe(0);
  });

  it('shows the numbers with formatOkrw: value without 원, then / max with 원', () => {
    const { container } = render(
      <Meter label="이번 달 배달비" value={won(210_000n)} max={BUDGET} tone="warn" />,
    );
    expect(container.querySelector(`.${styles.value}`)?.textContent).toBe('210,000');
    expect(container.querySelector(`.${styles.max}`)?.textContent).toBe(' / 300,000원');
    expect(screen.getByText('이번 달 배달비')).toBeInTheDocument();
  });

  it('reads as one meter with a label and the won text', () => {
    render(<Meter label="이번 달 배달비" value={won(210_000n)} max={BUDGET} tone="warn" />);
    const meter = screen.getByRole('meter', { name: '이번 달 배달비' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', '70');
    expect(meter).toHaveAttribute('aria-valuetext', '210,000원 / 300,000원');
  });

  it.each(['normal', 'warn', 'over'] as MeterTone[])('paints the %s tone', (tone) => {
    render(<Meter label="x" value={won(1_000n)} max={BUDGET} tone={tone} />);
    expect(fill()).toHaveAttribute('data-tone', tone);
  });

  // Main.dc.html line 31-36, Arrived.dc.html line 42-47.
  it('matches the design values', () => {
    expect(rule('.track')).toMatch(/height:\s*var\(--size-meter\)/);
    expect(rule('.track')).toMatch(/border-radius:\s*calc\(var\(--size-meter\) \/ 2\)/);
    expect(rule('.track')).toMatch(/background:\s*var\(--color-track\)/);
    expect(rule('.track')).toMatch(/overflow:\s*hidden/);
    expect(rule('.fill')).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(rule(".fill[data-tone='warn']")).toMatch(/background:\s*var\(--color-yolk\)/);
    expect(rule(".fill[data-tone='over']")).toMatch(/background:\s*var\(--color-over\)/);
    expect(rule('.sm')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.sm')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.md')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.md')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.row')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.label')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.value')).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
    expect(rule('.max')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.numbers')).toMatch(/tabular-nums/);
  });

  it.each(['sm', 'md'] as const)('puts only the %s size class on the meter', (size) => {
    const { container } = render(
      <Meter label="x" value={0n} max={BUDGET} tone="normal" size={size} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(styles[size]);
    expect(root.className).not.toContain(styles[size === 'sm' ? 'md' : 'sm']);
  });
});
