import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import chipStyles from '../../base/Chip/Chip.module.css';
import { BudgetPicker, formatManWon } from './BudgetPicker';

const css = readFileSync(resolve(__dirname, 'BudgetPicker.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const OPTIONS = [won(200_000n), won(300_000n), won(500_000n)];

describe('BudgetPicker (BudgetPicker.md 테스트 기준)', () => {
  it("shows '만 원' labels with fixed-width digits", () => {
    render(<BudgetPicker options={OPTIONS} value={won(300_000n)} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['20만 원', '30만 원', '50만 원']);
    for (const r of radios) {
      expect(r).toHaveClass(chipStyles.numeric ?? 'numeric');
      expect(r).toHaveClass(chipStyles.lg ?? 'lg');
    }
  });

  it.each([
    [won(300_000n), '30만 원'],
    [won(10_000n), '1만 원'],
    [won(12_340_000_000n), '1,234,000만 원'],
    [won(123_456n), '123,456원'], // not whole 만: the usual form
    [won(300_000n) + 1n, '300,000원'], // sub-won dust is not a whole 만
    [0n, '0원'],
  ])('formats %s as %s with bigint only', (aokrw, text) => {
    expect(formatManWon(aokrw)).toBe(text);
  });

  it('is a radio group named by its title, checking only the value', () => {
    render(<BudgetPicker options={OPTIONS} value={won(300_000n)} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: '이번 달 배달 예산' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('hands the picked bigint to onChange, by click and by arrow keys', async () => {
    const onChange = vi.fn();
    render(<BudgetPicker options={OPTIONS} value={won(300_000n)} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '50만 원' }));
    expect(onChange).toHaveBeenLastCalledWith(won(500_000n));
    expect(typeof onChange.mock.lastCall?.[0]).toBe('bigint');
    screen.getByRole('radio', { name: '30만 원' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(won(200_000n));
  });

  it('enters the group on the picked chip', () => {
    render(<BudgetPicker options={OPTIONS} value={won(500_000n)} onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  // Budget.dc.html 36-43.
  it('matches the design values', () => {
    expect(rule('.picker')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.title')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.choices')).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(rule('.choices')).toMatch(/gap:\s*var\(--space-2\)/);
  });
});
