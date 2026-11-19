import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as shared from '@sikyeoyong/shared';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CapReached, formatKstDateTime, kstDaysBetween } from './CapReached';

const css = readFileSync(resolve(__dirname, 'CapReached.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

// 2026-12-03 14:00 KST = 05:00 UTC
const RESET_MS = Date.UTC(2026, 11, 3, 5, 0);
const RESET_S = RESET_MS / 1000;
const DAY = 86_400_000;
// Buttons stack in base ActionPair; error lines are base ErrorLine. Their values live there.
const pairCss = readFileSync(
  resolve(__dirname, '../../base/ActionPair/ActionPair.module.css'),
  'utf8',
);
const pairRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    pairCss,
  )?.[2] ?? '';

const base = {
  resetAt: RESET_S,
  cap: okrwToAokrw(500_000n),
  onNotify: vi.fn(),
  onDismiss: vi.fn(),
};

describe('CapReached (CapReached.md 테스트 기준)', () => {
  it('uses the shared KST helpers, not a copy of its own', () => {
    expect(formatKstDateTime).toBe(shared.formatKstDateTime);
    expect(kstDaysBetween).toBe(shared.kstDaysBetween);
  });

  it('shows the refill time in KST like the design, whatever the device time zone', () => {
    render(<CapReached {...base} now={RESET_MS - 4 * DAY} />);
    expect(screen.getByText('12월 3일 오후 2시')).toBeInTheDocument();
    expect(screen.getByText('4일 뒤에 500,000원이 다시 채워져요')).toBeInTheDocument();
  });

  it('reads resetAt as unix seconds, not ms (no 1970, no year 58000)', () => {
    render(<CapReached {...base} now={RESET_MS - DAY} />);
    // Passing ms by mistake would show "1월 21일" of year ~58,000; seconds as ms would be 1970.
    expect(formatKstDateTime(RESET_S * 1000)).toBe('12월 3일 오후 2시');
    expect(screen.getByText('12월 3일 오후 2시')).toBeInTheDocument();
    expect(screen.queryByText(/1월 21일/)).toBeNull();
  });

  it.each([
    [Date.UTC(2026, 11, 3, 0, 0), '12월 3일 오전 9시'],
    [Date.UTC(2026, 11, 2, 15, 0), '12월 3일 오전 12시'], // midnight KST
    [Date.UTC(2026, 11, 3, 3, 0), '12월 3일 오후 12시'], // noon KST
    [Date.UTC(2026, 11, 3, 0, 30), '12월 3일 오전 9시 30분'],
    [Date.UTC(2026, 11, 31, 15, 5), '1월 1일 오전 12시 5분'], // new year in Seoul only
  ])('formats %s as %s', (ms, text) => {
    expect(formatKstDateTime(ms)).toBe(text);
  });

  it('rounds the shown time up to the minute, never earlier than the real reset', () => {
    render(<CapReached {...base} resetAt={RESET_S + 5 * 60 + 30} now={RESET_MS - DAY} />);
    expect(screen.getByText('12월 3일 오후 2시 6분')).toBeInTheDocument();
  });

  it('keeps an exact minute as it is', () => {
    render(<CapReached {...base} resetAt={RESET_S + 5 * 60} now={RESET_MS - DAY} />);
    expect(screen.getByText('12월 3일 오후 2시 5분')).toBeInTheDocument();
  });

  it('counts days on Korean dates: today, tomorrow, N days', () => {
    // 3 hours before 14:00 KST on the same Korean day
    render(<CapReached {...base} now={RESET_MS - 3 * 60 * 60 * 1000} />);
    expect(screen.getByText('오늘 500,000원이 다시 채워져요')).toBeInTheDocument();
    // 23:30 KST the day before is "tomorrow", though only 14.5 hours away
    expect(kstDaysBetween(Date.UTC(2026, 11, 2, 14, 30), RESET_MS)).toBe(1);
    expect(kstDaysBetween(RESET_MS - 4 * DAY, RESET_MS)).toBe(4);
    // Already past: still "today", never negative words
    expect(kstDaysBetween(RESET_MS + DAY, RESET_MS)).toBe(-1);
  });

  it('says 내일 for one day and 오늘 once past', () => {
    const { rerender } = render(<CapReached {...base} now={RESET_MS - DAY} />);
    expect(screen.getByText('내일 500,000원이 다시 채워져요')).toBeInTheDocument();
    rerender(<CapReached {...base} now={RESET_MS + DAY} />);
    expect(screen.getByText('오늘 500,000원이 다시 채워져요')).toBeInTheDocument();
  });

  it('shows the cap past Number exactly', () => {
    render(
      <CapReached {...base} cap={okrwToAokrw(123_456_789_012_345_678n)} now={RESET_MS - DAY} />,
    );
    expect(screen.getByText('내일 123,456,789,012,345,678원이 다시 채워져요')).toBeInTheDocument();
  });

  it('calls the matching callback once', async () => {
    const onNotify = vi.fn();
    const onDismiss = vi.fn();
    render(<CapReached {...base} onNotify={onNotify} onDismiss={onDismiss} now={RESET_MS} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 채워지면 알려 줘' }));
    expect(onNotify).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: '괜찮아, 며칠은 집밥 먹을게' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Cap.dc.html 30-40.
  it('matches the design values', () => {
    expect(rule('.when')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(rule('.when')).toMatch(/text-align:\s*center/);
    expect(rule('.date')).toMatch(/font-size:\s*var\(--type-display-size\)/);
    expect(rule('.date')).toMatch(/letter-spacing:\s*var\(--type-display-letter-spacing\)/);
    expect(rule('.note')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.note')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    {
      const { unmount } = render(<CapReached {...base} now={RESET_MS - DAY} />);
      expect(document.querySelector('.pair')?.classList).toContain('md');
      unmount();
    }
    expect(pairRule('.md')).toMatch(/gap:\s*var\(--space-2\)/);
  });
});
