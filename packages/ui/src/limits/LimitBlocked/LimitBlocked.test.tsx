import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LimitBlocked, levelWithRo } from './LimitBlocked';

const css = readFileSync(resolve(__dirname, 'LimitBlocked.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const base = {
  attempted: won(45_000n),
  limit: won(10_000n),
  onRaise: vi.fn(),
  onRepick: vi.fn(),
};

describe('LimitBlocked (LimitBlocked.md 테스트 기준)', () => {
  it('has no explanation paragraph: only the numbers and the two choices (no slop)', () => {
    const { container } = render(
      <LimitBlocked {...base} nextLevel={{ level: 3, limit: won(50_000n) }} />,
    );
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.textContent).toBe(
      '45,000원 / 10,000원까지레벨 3으로 올리고 시키기 한 번에 50,000원까지10,000원 안에서 다시 고르기',
    );
  });

  it('hides the raise button without a next level', () => {
    render(<LimitBlocked {...base} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /올리고/ })).toBeNull();
    expect(screen.getByRole('button', { name: '10,000원 안에서 다시 고르기' })).toBeInTheDocument();
  });

  it('calls the matching callback once', async () => {
    const onRaise = vi.fn();
    const onRepick = vi.fn();
    render(
      <LimitBlocked
        {...base}
        onRaise={onRaise}
        onRepick={onRepick}
        nextLevel={{ level: 3, limit: won(50_000n) }}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: '레벨 3으로 올리고 시키기 한 번에 50,000원까지' }),
    );
    expect(onRaise).toHaveBeenCalledTimes(1);
    expect(onRepick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /다시 고르기/ }));
    expect(onRepick).toHaveBeenCalledTimes(1);
  });

  it('shows amounts past Number exactly (hand-written)', () => {
    render(
      <LimitBlocked {...base} attempted={won(123_456_789_012_345_678n)} limit={won(10_000n)} />,
    );
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
  });

  it.each([
    [1, '1로'],
    [2, '2로'],
    [3, '3으로'],
    [4, '4로'],
    [5, '5로'],
    [6, '6으로'],
    [7, '7로'],
    [8, '8로'],
    [9, '9로'],
    [10, '10으로'],
    [11, '11로'],
  ])('reads level %s as %s', (level, text) => {
    expect(levelWithRo(level)).toBe(text);
  });

  // Blocked.dc.html 30-46.
  it('matches the design values', () => {
    expect(rule('.attempted')).toMatch(/font-size:\s*var\(--type-blocked-amount-size\)/);
    expect(rule('.attempted')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(rule('.limit')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(rule('.limit')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.compare')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.actions')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.raise')).toMatch(/min-height:\s*var\(--size-raise-button\)/);
    expect(rule('.raise')).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(rule('.raiseMain')).toMatch(/font-size:\s*var\(--type-button-size\)/);
    expect(rule('.raiseSub')).toMatch(/color:\s*var\(--color-leaf-sub-ink\)/);
    expect(rule('.repick')).toMatch(/min-height:\s*var\(--size-choice-button\)/);
    expect(rule('.repick')).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
    expect(rule('.repick')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
  });
});
