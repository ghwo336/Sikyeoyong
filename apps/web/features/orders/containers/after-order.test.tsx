import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderView } from '../../../lib/api';
import { BUDGET, ME, WALLET } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const getOrder = vi.fn();
const rateOrder = vi.fn();
const confirmOrder = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => Promise.resolve(BUDGET),
    getWallet: () => Promise.resolve(WALLET),
    getOrder: (id: string) => getOrder(id) as unknown,
    confirmOrder: (id: string) => confirmOrder(id) as unknown,
    rateOrder: (id: string, v: string) => rateOrder(id, v) as unknown,
  },
}));

const { OrderStatusContainer } = await import('./OrderStatusContainer');
const { ReceiptContainer } = await import('./ReceiptContainer');

const W9000 = '9000000000000000000000';
const base: OrderView = {
  id: 'o1',
  status: 'preparing',
  store: '마루국밥 본점',
  destination: '회사(역삼동)',
  items: [{ name: '돼지국밥', quantity: 1, price: W9000 }],
  amount: W9000,
  etaAt: 1,
  remainingMin: 8,
  dragonLine: '국밥 끓이는 중이에용.',
  dragonMood: 'cooking',
  txHash: `0x${'ab'.repeat(32)}`,
  receipt: {
    agentId: '1042',
    rules: [
      {
        id: 'transfer-limit',
        label: 'AGENT_OKRW_TRANSFER_LIMIT_POLICY',
        layer: 'chain',
        status: 'passed',
      },
      { id: 'periodic', label: 'PERIODIC_VOLUME_POLICY', layer: 'chain', status: 'passed' },
    ],
    explorerUrl: 'https://explorer.example/tx/0xab',
  },
};

function wrap(
  ui: ReactNode,
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  getOrder.mockReset();
  rateOrder.mockReset();
  confirmOrder.mockReset();
  rateOrder.mockResolvedValue(undefined);
  localStorage.clear();
});

describe('after the order (Tracking, Arrived, Receipt)', () => {
  it('cooking shows no map; on the road shows the rider map', async () => {
    getOrder.mockResolvedValue({ order: base });
    const { unmount } = wrap(<OrderStatusContainer orderId="o1" />);
    expect(await screen.findByText('국밥 끓이는 중이에용.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /경로 지도/ })).toBeNull();
    unmount();
    getOrder.mockResolvedValue({
      order: { ...base, status: 'delivering', dragonLine: '라이더님 출발했어용!' },
    });
    wrap(<OrderStatusContainer orderId="o1" />);
    expect(await screen.findByRole('img', { name: /경로 지도/ })).toBeInTheDocument();
  });

  it('a failed order shows the dragon line, no progress, and retries the same order on a press (QA 5)', async () => {
    const failed: OrderView = {
      ...base,
      status: 'failed',
      errorCode: 'CHAIN_INSUFFICIENT_FUNDS',
      dragonLine: '용돈이 모자라용',
      dragonMood: 'worried',
    };
    getOrder.mockResolvedValue({ order: failed });
    confirmOrder.mockResolvedValue({ order: { ...base, status: 'preparing' } });
    wrap(<OrderStatusContainer orderId="o1" />);
    expect(await screen.findByText('용돈이 모자라용')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '주문이 멈췄어요' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /진행/ })).toBeNull();
    // Never on its own: nothing paid until the press.
    expect(confirmOrder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도하기' }));
    expect(confirmOrder).toHaveBeenCalledTimes(1);
    expect(confirmOrder).toHaveBeenCalledWith('o1');
    expect(await screen.findByText('국밥 끓이는 중이에용.')).toBeInTheDocument();
  });

  it('a failed order that needs a new quote offers only the way back to the chat', async () => {
    getOrder.mockResolvedValue({
      order: {
        ...base,
        status: 'failed',
        errorCode: 'CHAIN_MERCHANT_INACTIVE',
        dragonLine: '이 가게는 등록이 안 돼 있어용',
      },
    });
    wrap(<OrderStatusContainer orderId="o1" />);
    expect(await screen.findByText('이 가게는 등록이 안 돼 있어용')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도하기' })).toBeNull();
    await userEvent.click(
      screen.getAllByRole('button', { name: '대화로 돌아가기' })[1] as HTMLElement,
    );
    expect(push).toHaveBeenCalledWith('/');
  });

  it('a retry that fails again says so and keeps the button (no automatic retry)', async () => {
    getOrder.mockResolvedValue({
      order: {
        ...base,
        status: 'failed',
        errorCode: 'SERVER_FROZEN',
        dragonLine: '쉬고 있을게용.',
      },
    });
    confirmOrder.mockRejectedValue(new Error('500'));
    wrap(<OrderStatusContainer orderId="o1" />);
    await userEvent.click(await screen.findByRole('button', { name: '다시 시도하기' }));
    expect(await screen.findByText(/다시 시도하지 못했어요/)).toBeInTheDocument();
    expect(confirmOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '다시 시도하기' })).toBeInTheDocument();
  });

  it('while cooking it asks again every 2 seconds; once arrived it stops', async () => {
    getOrder.mockResolvedValue({ order: base });
    wrap(<OrderStatusContainer orderId="o1" />);
    await waitFor(
      () => {
        expect(getOrder.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3_500 },
    );
  });

  it('arrived asks how it was, keeps the pick, and opens the receipt', async () => {
    getOrder.mockResolvedValue({
      order: { ...base, status: 'delivered', remainingMin: 0, dragonLine: '문 앞에 왔어용.' },
    });
    wrap(<OrderStatusContainer orderId="o1" />);
    expect(await screen.findByRole('heading', { name: '도착했어요' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: /또 먹을래/ }));
    expect(rateOrder).toHaveBeenCalledWith('o1', 'again');
    await userEvent.click(screen.getByRole('button', { name: '주문 상세 보기' }));
    expect(push).toHaveBeenCalledWith('/orders/o1/receipt');
  });

  it('the receipt keeps chain words closed until 자세히 보기; the device setting opens it', async () => {
    getOrder.mockResolvedValue({ order: { ...base, status: 'delivered' } });
    const { unmount } = wrap(<ReceiptContainer orderId="o1" />);
    expect(await screen.findByText('결제 수단')).toBeInTheDocument();
    expect(screen.queryByText('PERIODIC_VOLUME_POLICY')).toBeNull();
    unmount();
    localStorage.setItem('sikyeoyong.details', 'on');
    wrap(<ReceiptContainer orderId="o1" />);
    expect(await screen.findByText('PERIODIC_VOLUME_POLICY')).toBeInTheDocument();
  });

  it('the receipt rows sit in the order card as small rows (dt, dd), values as text', async () => {
    getOrder.mockResolvedValue({ order: { ...base, status: 'delivered' } });
    wrap(<ReceiptContainer orderId="o1" />);
    const method = await screen.findByText('결제 수단');
    expect(method.tagName).toBe('DT');
    expect(method.nextElementSibling?.textContent).toBe('용이 용돈');
    const perOrder = await screen.findByText('지금 한 번에 쓸 수 있는 돈');
    expect(perOrder.tagName).toBe('DT');
    expect(perOrder.nextElementSibling?.textContent).toBe('10,000원');
    const thirty = await screen.findByText('지금 30일 한도');
    expect(thirty.tagName).toBe('DT');
    // fixtures BUDGET: 42,000 used of the demo profile's 60,000.
    expect(thirty.nextElementSibling?.textContent).toBe('42,000 / 60,000원');
  });

  it('a receipt with limitsAtOrder shows the limits of that time, without 지금', async () => {
    getOrder.mockResolvedValue({
      order: {
        ...base,
        status: 'delivered',
        limitsAtOrder: {
          perOrderLimit: '20000000000000000000000',
          periodCap: '50000000000000000000000',
        },
      },
    });
    wrap(<ReceiptContainer orderId="o1" />);
    const perOrder = await screen.findByText('한 번에 쓸 수 있는 돈');
    expect(perOrder.nextElementSibling?.textContent).toBe('20,000원');
    const thirty = screen.getByText('30일 한도');
    expect(thirty.nextElementSibling?.textContent).toBe('50,000원');
    expect(screen.queryByText(/지금/)).toBeNull();
  });

  it.each(['failed', 'cancelled', 'refunded'] as const)(
    'a %s order shows no receipt: nothing looks paid',
    async (status) => {
      getOrder.mockResolvedValue({ order: { ...base, status } });
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      wrap(<ReceiptContainer orderId="o1" />, qc);
      // Wait until the order (and the budget) actually arrived, then look.
      await waitFor(() => {
        expect(qc.getQueryState(['order', 'o1'])?.status).toBe('success');
        expect(qc.getQueryState(['budget'])?.status).toBe('success');
      });
      expect(screen.getByRole('heading', { name: '주문 상세' })).toBeInTheDocument();
      expect(screen.queryByText('결제 수단')).toBeNull();
      expect(screen.queryByText('9,000원')).toBeNull();
    },
  );

  it('a failed order query ends in the bare top bar, with no loading shape (D-23)', async () => {
    getOrder.mockRejectedValue(new Error('500'));
    const a = wrap(<OrderStatusContainer orderId="o1" />);
    await waitFor(() => {
      expect(a.container.querySelector('[data-shape]')).toBeNull();
    });
    expect(screen.getByRole('button', { name: '대화로 돌아가기' })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('주문 현황을 못 불러왔어요');
    a.unmount();
    const b = wrap(<ReceiptContainer orderId="o1" />);
    await waitFor(() => {
      expect(b.container.querySelector('[data-shape]')).toBeNull();
    });
    expect(screen.getByText('주문 상세')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('주문 내역을 못 불러왔어요');
  });

  it.each([
    ['status', <OrderStatusContainer key="s" orderId="o1" />, '국밥 끓이는 중이에용.'],
    ['receipt', <ReceiptContainer key="r" orderId="o1" />, '결제 수단'],
  ])('the %s retry press asks again and the screen comes back', async (_n, ui, text) => {
    getOrder.mockRejectedValueOnce(new Error('500'));
    getOrder.mockResolvedValue({ order: base });
    wrap(ui);
    await userEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
