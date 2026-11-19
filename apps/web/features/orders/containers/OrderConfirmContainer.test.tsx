import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderQuote, OrderView } from '../../../lib/api';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

const confirmOrder = vi.fn<(id: string) => Promise<{ order: OrderView }>>();
vi.mock('../../../lib/api', () => ({ api: { confirmOrder: (id: string) => confirmOrder(id) } }));

const { OrderConfirmContainer } = await import('./OrderConfirmContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();
const quote: OrderQuote = {
  orderId: 'order-1',
  store: '마루국밥 본점',
  destination: '회사(역삼동)',
  etaMin: 25,
  items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
  request: '깍두기 많이',
  amount: won(9_000n),
  dragonLine: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
  perOrderLimit: won(10_000n),
  periodUsedAfter: won(219_000n),
  periodCap: won(500_000n),
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OrderConfirmContainer', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    confirmOrder.mockReset();
  });

  it('shows the quote from the server as is', () => {
    wrap(<OrderConfirmContainer quote={quote} open species="forest" onClose={vi.fn()} />);
    expect(screen.getByText('마루국밥 본점에서 회사(역삼동)로, 25분쯤')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: '한 번에' })).toHaveAttribute(
      'aria-valuetext',
      '9,000원 / 10,000원',
    );
    expect(screen.getByRole('meter', { name: '30일 동안 (주문 후)' })).toHaveAttribute(
      'aria-valuetext',
      '219,000원 / 500,000원',
    );
  });

  it('one press confirms once and moves on at once (optimistic)', async () => {
    confirmOrder.mockReturnValue(new Promise(() => undefined));
    wrap(<OrderConfirmContainer quote={quote} open species="forest" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /시키기/ }));
    expect(confirmOrder).toHaveBeenCalledTimes(1);
    expect(confirmOrder).toHaveBeenCalledWith('order-1');
    expect(push).toHaveBeenCalledWith('/orders/order-1');
  });

  it('a failed confirm goes back to the chat and is not retried', async () => {
    confirmOrder.mockRejectedValue(new Error('rejected'));
    wrap(<OrderConfirmContainer quote={quote} open species="forest" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /시키기/ }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
    expect(confirmOrder).toHaveBeenCalledTimes(1);
  });

  it('다시 고를래 closes without paying; opening alone never pays', async () => {
    const onClose = vi.fn();
    wrap(<OrderConfirmContainer quote={quote} open species="forest" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 고를래' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it('draws nothing without a quote', () => {
    const { container } = wrap(
      <OrderConfirmContainer quote={undefined} open={false} species="forest" onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
