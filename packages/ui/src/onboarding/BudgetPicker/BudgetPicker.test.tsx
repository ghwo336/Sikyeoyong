import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import chipStyles from '../../base/Chip/Chip.module.css';
import { BudgetPicker } from './BudgetPicker';

const css = readFileSync(resolve(__dirname, 'BudgetPicker.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const OPTIONS = [won(200_000n), won(300_000n), won(500_000n)];

describe('BudgetPicker (BudgetPicker.md 테스트 기준)', () => {
  it('shows formatOkrw labels with fixed-width digits (Q-23 still open)', () => {
    render(<BudgetPicker options={OPTIONS} value={won(300_000n)} onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['200,000원', '300,000원', '500,000원']);
    for (const r of radios) {
      expect(r).toHaveClass(chipStyles.numeric ?? 'numeric');
      expect(r).toHaveClass(chipStyles.lg ?? 'lg');
    }
  });

  it('shows amounts past Number exactly', () => {
    render(
      <BudgetPicker
        options={[won(123_456_789_012_345_678n)]}
        value={won(123_456_789_012_345_678n)}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio')).toHaveTextContent('123,456,789,012,345,678원');
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
    await userEvent.click(screen.getByRole('radio', { name: '500,000원' }));
    expect(onChange).toHaveBeenLastCalledWith(won(500_000n));
    expect(typeof onChange.mock.lastCall?.[0]).toBe('bigint');
    screen.getByRole('radio', { name: '300,000원' }).focus();
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
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.title')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.choices')).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(rule('.choices')).toMatch(/gap:\s*var\(--space-2\)/);
  });
});
