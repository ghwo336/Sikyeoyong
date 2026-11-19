import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AllowanceSummary } from './AllowanceSummary';

const css = readFileSync(resolve(__dirname, 'AllowanceSummary.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const base = { owner: won(81_000n), pocket: won(20_000n), onTopUp: vi.fn() };

describe('AllowanceSummary (AllowanceSummary.md 테스트 기준)', () => {
  it('shows no address: only the words and amounts of the design', () => {
    const { container } = render(<AllowanceSummary {...base} />);
    expect(container.textContent).toBe('주인님 용돈81,000원용이 주머니에 20,000원채우기');
    expect(container.textContent).not.toMatch(/0x[0-9a-fA-F]/);
  });

  it('has no address prop at all (typecheck fails if one is added)', () => {
    // @ts-expect-error AllowanceSummary must never take an address (AllowanceSummary.md).
    render(<AllowanceSummary {...base} address="0xabc" />);
    expect(screen.queryByText(/0xabc/)).toBeNull();
  });

  it('does not start a top-up while balances are loading', async () => {
    const onTopUp = vi.fn();
    render(<AllowanceSummary {...base} onTopUp={onTopUp} loading />);
    const button = screen.getByRole('button', { name: '채우기' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onTopUp).not.toHaveBeenCalled();
  });

  it('shows amounts with formatOkrw, past Number exactly', () => {
    render(<AllowanceSummary {...base} owner={won(123_456_789_012_345_678n)} pocket={0n} />);
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
    expect(screen.getByText('용이 주머니에 0원')).toBeInTheDocument();
  });

  it('asks the parent to top up once', async () => {
    const onTopUp = vi.fn();
    render(<AllowanceSummary {...base} onTopUp={onTopUp} />);
    await userEvent.click(screen.getByRole('button', { name: '채우기' }));
    expect(onTopUp).toHaveBeenCalledTimes(1);
  });

  it('shows still bars and no numbers while loading', () => {
    const { container } = render(<AllowanceSummary {...base} loading />);
    expect(container.querySelectorAll('[data-part="skeleton"]')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/원/);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(css).not.toMatch(/@keyframes|animation/);
  });

  // Wallet.dc.html 24-31.
  it('matches the design values', () => {
    expect(rule('.summary')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.summary')).toMatch(/align-items:\s*flex-end/);
    expect(rule('.summary')).toMatch(/padding:\s*var\(--space-4\) 0 var\(--space-5\)/);
    expect(rule('.amounts')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(rule('.label')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.owner')).toMatch(/font-size:\s*var\(--type-wallet-amount-size\)/);
    expect(rule('.owner')).toMatch(/font-weight:\s*var\(--type-wallet-amount-weight\)/);
    expect(rule('.amounts')).toMatch(/tabular-nums/);
    expect(rule('.owner')).toMatch(/letter-spacing:\s*var\(--type-wallet-amount-letter-spacing\)/);
    expect(rule('.pocket')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.pocket')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
