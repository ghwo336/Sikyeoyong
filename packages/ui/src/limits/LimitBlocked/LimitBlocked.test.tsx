import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LimitBlocked } from './LimitBlocked';

const css = readFileSync(resolve(__dirname, 'LimitBlocked.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
// The buttons are base Button; their sizes live in Button.module.css.
const buttonCss = readFileSync(resolve(__dirname, '../../base/Button/Button.module.css'), 'utf8');
const buttonRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(buttonCss)?.[2] ??
  '';

// Buttons stack in base ActionPair; error lines are base ErrorLine. Their values live there.
const pairCss = readFileSync(
  resolve(__dirname, '../../base/ActionPair/ActionPair.module.css'),
  'utf8',
);
const pairRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    pairCss,
  )?.[2] ?? '';

// The amount and limit are base AmountRatio blocked; their values live there.
const ratioCss = readFileSync(
  resolve(__dirname, '../../base/AmountRatio/AmountRatio.module.css'),
  'utf8',
);
const ratioRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(ratioCss)?.[2] ??
  '';

const won = (n: bigint) => okrwToAokrw(n);
const base = {
  attempted: won(45_000n),
  limit: won(10_000n),
  onRaise: vi.fn(),
  onRepick: vi.fn(),
};

describe('LimitBlocked (LimitBlocked.md 테스트 기준)', () => {
  it('has no explanation paragraph: only the numbers and the two choices (no slop)', () => {
    const { container } = render(<LimitBlocked {...base} raiseTo={won(45_000n)} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.textContent).toBe(
      '45,000원 / 10,000원까지한 번에 45,000원으로 올리고 시키기10,000원 안에서 다시 고르기',
    );
  });

  it('hides the raise button when no limit fits (raiseTo missing)', () => {
    render(<LimitBlocked {...base} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /올리고/ })).toBeNull();
    expect(screen.getByRole('button', { name: '10,000원 안에서 다시 고르기' })).toBeInTheDocument();
  });

  it('calls the matching callback once', async () => {
    const onRaise = vi.fn();
    const onRepick = vi.fn();
    render(<LimitBlocked {...base} onRaise={onRaise} onRepick={onRepick} raiseTo={won(45_000n)} />);
    await userEvent.click(
      screen.getByRole('button', { name: '한 번에 45,000원으로 올리고 시키기' }),
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
    [won(5_000n), '한 번에 5,000원으로 올리고 시키기'],
    [won(50_000n), '한 번에 50,000원으로 올리고 시키기'],
    [won(123_456_789_012_345_678n), '한 번에 123,456,789,012,345,678원으로 올리고 시키기'],
  ])('names the new limit with 원으로 (%s)', (raiseTo, name) => {
    render(<LimitBlocked {...base} raiseTo={raiseTo} />);
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  // Blocked.dc.html 30-46.
  it('matches the design values', () => {
    {
      const { container, unmount } = render(<LimitBlocked {...base} />);
      expect(container.querySelector('.compare > .ratio')?.classList).toContain('blocked');
      unmount();
    }
    expect(ratioRule('.blocked .value')).toMatch(/font-size:\s*var\(--type-blocked-amount-size\)/);
    expect(ratioRule('.blocked .value')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(ratioRule('.blocked .max')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(ratioRule('.blocked .max')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(ratioRule('.blocked')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    {
      const { unmount } = render(<LimitBlocked {...base} />);
      expect(document.querySelector('.pair')?.classList).toContain('md');
      unmount();
    }
    expect(pairRule('.md')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.raiseMain')).toMatch(/font-size:\s*var\(--type-button-size\)/);
    expect(rule('.raiseMain')).toMatch(/font-weight:\s*var\(--type-button-weight\)/);
    // Raise: Button primary tall (64, leaf). Repick: Button secondary choice (52, pale line, 15/600).
    render(<LimitBlocked {...base} raiseTo={won(45_000n)} />);
    const raise = screen.getByRole('button', { name: /올리고/ });
    expect([...raise.classList]).toEqual(expect.arrayContaining(['primary', 'tall']));
    const repick = screen.getByRole('button', { name: /다시 고르기/ });
    expect([...repick.classList]).toEqual(expect.arrayContaining(['secondary', 'choice']));
    expect(buttonRule('.tall')).toMatch(/min-height:\s*var\(--size-raise-button\)/);
    expect(buttonRule('.primary')).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(buttonRule('.choice')).toMatch(/min-height:\s*var\(--size-choice-button\)/);
    expect(buttonRule('.choice')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(buttonRule('.choice')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(buttonRule('.secondary')).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
  });
});
