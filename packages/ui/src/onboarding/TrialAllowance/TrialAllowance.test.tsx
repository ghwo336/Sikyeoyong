import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TrialAllowance } from './TrialAllowance';

const css = readFileSync(resolve(__dirname, 'TrialAllowance.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const AMOUNT = okrwToAokrw(100_000n);

describe('TrialAllowance (TrialAllowance.md 테스트 기준)', () => {
  it('shows the name and the amount with formatOkrw', () => {
    render(<TrialAllowance amount={AMOUNT} status="idle" onClaim={vi.fn()} />);
    expect(screen.getByText('체험용 용돈')).toBeInTheDocument();
    expect(screen.getByText('100,000원')).toBeInTheDocument();
  });

  it('keeps precision past what a Number can hold', () => {
    render(<TrialAllowance amount={9_007_199_254_740_993n} status="idle" onClaim={vi.fn()} />);
    expect(screen.getByText(/원$/)).toBeInTheDocument();
  });

  it('asks once per press while idle', async () => {
    const onClaim = vi.fn();
    render(<TrialAllowance amount={AMOUNT} status="idle" onClaim={onClaim} />);
    await userEvent.click(screen.getByRole('button', { name: '받기' }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('does not ask again while pending, however often it is pressed', async () => {
    const onClaim = vi.fn();
    render(<TrialAllowance amount={AMOUNT} status="pending" onClaim={onClaim} />);
    const button = screen.getByRole('button', { name: '받기' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('says it arrived and has no button once done', () => {
    const onClaim = vi.fn();
    render(<TrialAllowance amount={AMOUNT} status="done" onClaim={onClaim} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('받았어요')).toBeInTheDocument();
    expect(screen.getByText('받았어요').parentElement).toHaveAttribute('aria-live', 'polite');
  });

  // Budget.dc.html 45-51.
  it('matches the design values', () => {
    expect(rule('.row')).toMatch(/border-top:\s*1px solid var\(--color-line\)/);
    expect(rule('.row')).toMatch(/padding-top:\s*var\(--size-trial-top\)/);
    expect(rule('.row')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.text')).toMatch(/flex-direction:\s*column/);
    expect(rule('.label')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.label')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.amount')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.amount')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.amount')).toMatch(/tabular-nums/);
    expect(rule('.done')).toMatch(/color:\s*var\(--color-leaf\)/);
  });
});
