import { AppError } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderStatus, OrderView } from '../../../lib/api';
import { ME } from '../../../lib/mock/fixtures';
import { orderKey } from '../hooks/useOrder';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const listOrders = vi.fn();
const listApprovals = vi.fn();
const approveApproval = vi.fn();
const confirmOrder = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    listOrders: () => listOrders() as unknown,
    listApprovals: () => listApprovals() as unknown,
    approveApproval: (id: string) => approveApproval(id) as unknown,
    confirmOrder: (id: string) => confirmOrder(id) as unknown,
  },
}));

const { ActiveOrderContainer } = await import('./ActiveOrderContainer');
const { OrderHistoryContainer } = await import('./OrderHistoryContainer');

const W9000 = '9000000000000000000000';
const W12000 = '12000000000000000000000';

function view(id: string, status: OrderStatus, more: Partial<OrderView> = {}): OrderView {
  return {
    id,
    status,
    store: '마루국밥 본점',
    destination: '회사(역삼동)',
    items: [{ name: '돼지국밥', quantity: 1, price: W9000 }],
    amount: W9000,
    etaAt: 1,
    remainingMin: 8,
    dragonLine: '라이더님 출발했어용!',
    dragonMood: 'excited',
    ...more,
  };
}

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { qc, ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  push.mockReset();
  listOrders.mockReset();
  listApprovals.mockReset();
  listApprovals.mockResolvedValue({ approvals: [] });
  approveApproval.mockReset();
  confirmOrder.mockReset();
});

describe('ActiveOrderContainer (Main.dc.html 진행 중인 주문)', () => {
  it('shows the newest order on its way and opens its status screen with the order in hand', async () => {
    const order = view('o2', 'delivering');
    listOrders.mockResolvedValue({
      orders: [view('o3', 'delivered'), order, view('o1', 'preparing')],
    });
    const { qc } = wrap(<ActiveOrderContainer />);
    const card = await screen.findByRole('button', {
      name: '진행 중인 주문: 돼지국밥 배달 중, 8분 남았어요',
    });
    await userEvent.click(card);
    expect(push).toHaveBeenCalledWith('/orders/o2');
    expect(qc.getQueryData(orderKey('o2'))).toEqual(order);
  });

  it('a cooking order opens the same status screen (Done)', async () => {
    listOrders.mockResolvedValue({ orders: [view('o1', 'preparing')] });
    wrap(<ActiveOrderContainer />);
    await userEvent.click(
      await screen.findByRole('button', { name: '진행 중인 주문: 돼지국밥 조리 중, 곧 출발해요' }),
    );
    expect(push).toHaveBeenCalledWith('/orders/o1');
  });

  it('draws nothing when no order is on its way, or the list cannot be had', async () => {
    listOrders.mockResolvedValue({ orders: [view('o1', 'delivered')] });
    const { container, unmount } = wrap(<ActiveOrderContainer />);
    await vi.waitFor(() => {
      expect(listOrders).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
    unmount();
    listOrders.mockRejectedValue(new AppError('INTERNAL'));
    const failed = wrap(<ActiveOrderContainer />);
    await vi.waitFor(() => {
      expect(listOrders).toHaveBeenCalledTimes(2);
    });
    expect(failed.container).toBeEmptyDOMElement();
  });
});

describe('OrderHistoryContainer (주문 내역, ListRow list)', () => {
  it('lists the orders newest first with their amounts, and opens each where it belongs', async () => {
    listOrders.mockResolvedValue({
      orders: [
        view('o3', 'delivering'),
        view('o2', 'delivered', {
          items: [{ name: '보쌈 정식', quantity: 1, price: W12000 }],
          amount: W12000,
        }),
      ],
    });
    wrap(<OrderHistoryContainer />);
    expect(screen.getByRole('heading', { name: '주문 내역' })).toBeInTheDocument();
    const rows = await screen.findAllByRole('button', { name: /원/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      '돼지국밥, 배달 중9,000원',
      '보쌈 정식12,000원',
    ]);
    await userEvent.click(rows[1] as HTMLElement);
    expect(push).toHaveBeenLastCalledWith('/orders/o2/receipt');
    await userEvent.click(rows[0] as HTMLElement);
    expect(push).toHaveBeenLastCalledWith('/orders/o3');
  });

  it('shows the row shapes while loading, the dragon line when empty, one line on failure', async () => {
    listOrders.mockReturnValue(new Promise(() => undefined));
    const loading = wrap(<OrderHistoryContainer />);
    expect(loading.container.querySelectorAll('[data-part="skeleton"]')).toHaveLength(2);
    loading.unmount();

    listOrders.mockResolvedValue({ orders: [] });
    const empty = wrap(<OrderHistoryContainer />);
    expect(await screen.findByText('아직 시킨 게 없어용.')).toBeInTheDocument();
    empty.unmount();

    listOrders.mockRejectedValue(new AppError('INTERNAL'));
    wrap(<OrderHistoryContainer />);
    expect(await screen.findByRole('alert')).toHaveTextContent('주문 내역을 못 불러왔어요');
  });

  it('an order waiting for the owner carries its approval card; a yes hands the quote to the chat and pays nothing', async () => {
    listOrders.mockResolvedValue({
      orders: [
        view('o9', 'pending_approval', {
          store: '한상보쌈',
          items: [{ name: '보쌈 정식', quantity: 1, price: W12000 }],
          amount: W12000,
        }),
        view('o1', 'delivered'),
      ],
    });
    listApprovals.mockResolvedValue({
      approvals: [
        {
          id: 'ap9',
          orderId: 'o9',
          reason: 'NEW_MERCHANT',
          store: '한상보쌈',
          amount: W12000,
          expiresAt: 1,
        },
      ],
    });
    const quote = { orderId: 'o9', store: '한상보쌈', amount: W12000 };
    approveApproval.mockResolvedValue({
      approval: { id: 'ap9', status: 'approved' },
      order: { id: 'o9', status: 'quoted' },
      quote,
    });
    const { qc } = wrap(<OrderHistoryContainer />);
    const card = await screen.findByRole('region', { name: '주인님 허락' });
    expect(card).toHaveTextContent('처음 시키는 가게예요');
    expect(card).toHaveTextContent('12,000원');
    // Only the waiting row has a card.
    expect(screen.getAllByRole('region', { name: '주인님 허락' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '허락하기' }));
    await vi.waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
    expect(approveApproval).toHaveBeenCalledWith('ap9');
    expect(qc.getQueryData(['chat', 'handoff'])).toEqual(quote);
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it('a per-order wait gets no owner card here (the limit screens own it); a waiting row without an approval neither', async () => {
    listOrders.mockResolvedValue({ orders: [view('o9', 'pending_approval', { amount: W12000 })] });
    listApprovals.mockResolvedValue({
      approvals: [
        {
          id: 'ap9',
          orderId: 'o9',
          reason: 'OVER_LEVEL_LIMIT',
          store: '마루국밥 본점',
          amount: W12000,
          expiresAt: 1,
        },
      ],
    });
    wrap(<OrderHistoryContainer />);
    await screen.findByText(/허락 기다리는 중/);
    await vi.waitFor(() => {
      expect(listApprovals).toHaveBeenCalled();
    });
    expect(screen.queryByRole('region', { name: '주인님 허락' })).toBeNull();
  });

  it('a 멈춤 row opens the order status screen (QA 5)', async () => {
    listOrders.mockResolvedValue({
      orders: [view('o4', 'failed', { errorCode: 'SERVER_NEW_MERCHANT' })],
    });
    wrap(<OrderHistoryContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /멈춤/ }));
    expect(push).toHaveBeenCalledWith('/orders/o4');
  });

  it('a cancelled row cannot be opened', async () => {
    listOrders.mockResolvedValue({ orders: [view('o5', 'cancelled')] });
    wrap(<OrderHistoryContainer />);
    expect(await screen.findByText('돼지국밥, 취소')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /취소/ })).toBeNull();
  });

  it('back goes to the chat', async () => {
    listOrders.mockResolvedValue({ orders: [] });
    wrap(<OrderHistoryContainer />);
    await userEvent.click(screen.getByRole('button', { name: '대화로 돌아가기' }));
    expect(push).toHaveBeenCalledWith('/');
  });
});
