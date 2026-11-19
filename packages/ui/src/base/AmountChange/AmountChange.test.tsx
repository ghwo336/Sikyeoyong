import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmountChange } from './AmountChange';

const css = readFileSync(resolve(__dirname, 'AmountChange.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);

describe('AmountChange (AmountChange.md 테스트 기준)', () => {
  it('reads "A에서 B으로" with formatOkrw on both', () => {
    const { container } = render(<AmountChange from={won(10_000n)} to={won(50_000n)} />);
    expect(container.textContent).toBe('10,000원에서50,000원으로');
  });

  it('strikes the old amount and makes the new one bold', () => {
    render(<AmountChange from={won(10_000n)} to={won(50_000n)} />);
    expect(screen.getByText('10,000원').closest('s')).not.toBeNull();
    expect(screen.getByText('50,000원').closest('b')).not.toBeNull();
  });

  it('hides the arrow from screen readers', () => {
    const { container } = render(<AmountChange from={1n} to={2n} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('data-icon', 'arrow-right');
  });

  it('shows amounts past Number exactly', () => {
    render(<AmountChange from={won(1n)} to={won(123_456_789_012_345_678n)} />);
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
  });

  // LimitChat.dc.html 40-44.
  it('matches the design values', () => {
    expect(rule('.change')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.from')).toMatch(/color:\s*var\(--color-ink-muted\)/);
    expect(rule('.from')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.arrow')).toMatch(/width:\s*var\(--size-arrow-icon\)/);
    expect(rule('.to')).toMatch(/font-size:\s*var\(--type-change-to-size\)/);
    expect(rule('.to')).toMatch(/font-weight:\s*var\(--type-change-to-weight\)/);
  });
});
