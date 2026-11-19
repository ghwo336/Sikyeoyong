import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmountRatio } from './AmountRatio';

const css = readFileSync(resolve(__dirname, 'AmountRatio.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);

describe('AmountRatio (AmountRatio.md 테스트 기준)', () => {
  it('reads "value / max" with formatOkrw on both', () => {
    const { container } = render(
      <AmountRatio value={won(45_000n)} max={won(10_000n)} size="blocked" suffix="까지" />,
    );
    expect(container.textContent).toBe('45,000원 / 10,000원까지');
    expect(screen.getByText('45,000원')).toBeInTheDocument();
  });

  it('drops 원 after the value for meters, keeping it on the max', () => {
    const { container } = render(
      <AmountRatio value={won(210_000n)} max={won(300_000n)} size="meter" valueUnit={false} />,
    );
    expect(container.querySelector('.value')?.textContent).toBe('210,000');
    expect(container.querySelector('.max')?.textContent).toBe(' / 300,000원');
  });

  it('shows amounts past Number exactly', () => {
    render(<AmountRatio value={won(123_456_789_012_345_678n)} max={won(10_000n)} size="blocked" />);
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
  });

  it.each(['meter', 'blocked'] as const)('puts the %s size class on the root', (size) => {
    const { container } = render(<AmountRatio value={1n} max={2n} size={size} />);
    expect(container.firstElementChild?.classList).toContain(size);
  });

  // Main and Confirm meters; Blocked.dc.html 30-34.
  it('matches the design values', () => {
    expect(rule('.ratio')).toMatch(/tabular-nums/);
    expect(rule('.meter .value')).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
    expect(rule('.meter .max')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.blocked')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.blocked .value')).toMatch(/font-size:\s*var\(--type-blocked-amount-size\)/);
    expect(rule('.blocked .value')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(rule('.blocked .max')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(rule('.blocked .max')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
