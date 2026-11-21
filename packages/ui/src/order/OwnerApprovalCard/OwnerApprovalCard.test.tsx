import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OwnerApprovalCard } from './OwnerApprovalCard';

const css = readFileSync(resolve(__dirname, 'OwnerApprovalCard.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const base = () => ({
  reason: 'NEW_MERCHANT' as const,
  store: '한상보쌈',
  amount: okrwToAokrw(12_000n),
  onApprove: vi.fn(),
  onReject: vi.fn(),
});

describe('OwnerApprovalCard (OwnerApprovalCard.md 테스트 기준)', () => {
  it('keeps the app colors whatever the dragon species (D-32 fixed theme)', () => {
    const { container } = render(
      <div data-species="star">
        <OwnerApprovalCard {...base()} />
      </div>,
    );
    expect(container.querySelector('section')).toHaveAttribute('data-theme', 'fixed');
  });

  it('says what it is for each reason, with the store and the amount via formatOkrw', () => {
    const { rerender } = render(<OwnerApprovalCard {...base()} />);
    expect(screen.getByText('처음 시키는 가게예요')).toBeInTheDocument();
    expect(screen.getByText('한상보쌈')).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
    rerender(<OwnerApprovalCard {...base()} reason="OVER_PERSONAL_BUDGET" />);
    expect(screen.getByText('30일에 쓸 돈을 넘어요')).toBeInTheDocument();
  });

  it('shows an amount beyond Number exactly', () => {
    render(<OwnerApprovalCard {...base()} amount={okrwToAokrw(9_007_199_254_740_993n)} />);
    expect(screen.getByText('9,007,199,254,740,993원')).toBeInTheDocument();
  });

  it('each button calls its own callback once', async () => {
    const p = base();
    render(<OwnerApprovalCard {...p} />);
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    expect(p.onApprove).toHaveBeenCalledTimes(1);
    expect(p.onReject).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '안 시킬래요' }));
    expect(p.onReject).toHaveBeenCalledTimes(1);
  });

  it('a double tap approves once', async () => {
    const p = base();
    render(<OwnerApprovalCard {...p} />);
    await userEvent.dblClick(screen.getByRole('button', { name: '허락하기' }));
    expect(p.onApprove).toHaveBeenCalledTimes(1);
  });

  it('while one answer is on its way neither button answers', async () => {
    const p = base();
    render(<OwnerApprovalCard {...p} status="approving" />);
    expect(screen.getByRole('button', { name: '허락하기' })).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    await userEvent.click(screen.getByRole('button', { name: '안 시킬래요' }));
    expect(p.onApprove).not.toHaveBeenCalled();
    expect(p.onReject).not.toHaveBeenCalled();
  });

  it('after a failure the line shows and the answer can be sent again', async () => {
    const p = base();
    render(<OwnerApprovalCard {...p} status="failed" />);
    expect(screen.getByText('답을 못 보냈어요. 다시 해 볼까요?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    expect(p.onApprove).toHaveBeenCalledTimes(1);
  });

  it('has no blockchain words and no level word on screen', () => {
    const { container } = render(<OwnerApprovalCard {...base()} status="failed" />);
    expect(container.textContent).not.toMatch(/지갑|토큰|트랜잭션|KYC|PCL|체인|레벨/);
  });

  it('is the LimitChat card frame in the theme color', () => {
    expect(rule('.card')).toMatch(/border:\s*2px solid var\(--theme-accent\)/);
    expect(rule('.card')).toMatch(/border-radius:\s*var\(--radius-card\)/);
  });
});
