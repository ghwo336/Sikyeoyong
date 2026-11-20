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
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => Promise.resolve(BUDGET),
    getWallet: () => Promise.resolve(WALLET),
    getOrder: (id: string) => getOrder(id) as unknown,
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

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  push.mockReset();
  getOrder.mockReset();
  rateOrder.mockReset();
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
    const perOrder = await screen.findByText('한 번에 쓸 수 있는 돈');
    expect(perOrder.tagName).toBe('DT');
    expect(perOrder.nextElementSibling?.textContent).toBe('9,000 / 10,000원');
  });

  it.each(['failed', 'cancelled', 'refunded'] as const)(
    'a %s order shows no receipt: nothing looks paid',
    async (status) => {
      getOrder.mockResolvedValue({ order: { ...base, status } });
      wrap(<ReceiptContainer orderId="o1" />);
      expect(await screen.findByRole('heading', { name: '주문 상세' })).toBeInTheDocument();
      expect(screen.queryByText('결제 수단')).toBeNull();
      expect(screen.queryByText('9,000원')).toBeNull();
    },
  );
});
