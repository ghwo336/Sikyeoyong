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

// The numbers are base AmountRatio meter; their values live in AmountRatio.module.css.
const ratioCss = readFileSync(resolve(__dirname, '../AmountRatio/AmountRatio.module.css'), 'utf8');
const ratioRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(ratioCss)?.[2] ??
  '';

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

  // Main.dc.html line 31-36, Arrived.dc.html line 42-47, Confirm.dc.html line 44-52.
  it('matches the design values', () => {
    expect(rule('.track')).toMatch(/height:\s*var\(--size-meter\)/);
    expect(rule('.track')).toMatch(/border-radius:\s*calc\(var\(--size-meter\) \/ 2\)/);
    expect(rule('.track')).toMatch(/background:\s*var\(--theme-track\)/);
    expect(rule('.track')).toMatch(/overflow:\s*hidden/);
    // budget: yolk on the light track. limit: leaf on the line track, gap 6.
    expect(rule('.budget .track')).toMatch(/background:\s*var\(--theme-track\)/);
    expect(rule('.budget .fill')).toMatch(/background:\s*var\(--color-yolk\)/);
    expect(rule('.limit .track')).toMatch(/background:\s*var\(--color-line\)/);
    expect(rule('.limit .fill')).toMatch(/background:\s*var\(--theme-accent\)/);
    expect(rule('.meter.limit')).toMatch(/gap:\s*var\(--size-meter-limit-gap\)/);
    // warn and over win over both kinds (higher specificity than .kind .fill)
    expect(rule(".meter .fill[data-tone='warn']")).toMatch(/background:\s*var\(--color-yolk\)/);
    expect(rule(".meter .fill[data-tone='over']")).toMatch(/background:\s*var\(--color-over\)/);
    expect(rule('.sm')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.sm')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.md')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.md')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.row')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.label')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(ratioRule('.meter .value')).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
    expect(ratioRule('.meter .max')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(ratioRule('.ratio')).toMatch(/tabular-nums/);
  });

  it.each(['budget', 'limit'] as const)('puts only the %s kind class on the meter', (kind) => {
    const { container } = render(
      <Meter label="x" value={0n} max={BUDGET} tone="normal" kind={kind} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(styles[kind]);
    expect(root.className).not.toContain(styles[kind === 'budget' ? 'limit' : 'budget']);
  });

  it('sits in the Main card only when framed', () => {
    const { container, rerender } = render(
      <Meter label="x" value={0n} max={BUDGET} tone="normal" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toHaveAttribute('data-framed');
    rerender(<Meter label="x" value={0n} max={BUDGET} tone="normal" framed />);
    expect(root).toHaveAttribute('data-framed');
    // Main.dc.html: white, 1px line, radius 16, 12 14 inside.
    const card = rule('.meter[data-framed]');
    expect(card).toMatch(/padding:\s*var\(--space-3\) var\(--size-budget-card-pad-x\)/);
    expect(card).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-budget-card\)/);
    expect(card).toMatch(/background:\s*var\(--color-surface\)/);
  });

  it('is a budget meter by default', () => {
    const { container } = render(<Meter label="x" value={0n} max={BUDGET} tone="normal" />);
    expect((container.firstElementChild as HTMLElement).className).toContain(styles.budget);
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
