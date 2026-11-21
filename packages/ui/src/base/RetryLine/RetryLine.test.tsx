import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RetryLine } from './RetryLine';

describe('RetryLine (RetryLine.md 테스트 기준)', () => {
  it('says the line as an alert and a retry button under it', () => {
    render(<RetryLine onRetry={vi.fn()}>주문 내역을 못 불러왔어요</RetryLine>);
    expect(screen.getByRole('alert')).toHaveTextContent('주문 내역을 못 불러왔어요');
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });

  it('a press calls onRetry once, and the label can change', async () => {
    const onRetry = vi.fn();
    render(
      <RetryLine onRetry={onRetry} retryLabel="다시 해 볼까요">
        x
      </RetryLine>,
    );
    await userEvent.click(screen.getByRole('button', { name: '다시 해 볼까요' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
