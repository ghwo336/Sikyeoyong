import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockSession, setMockChainUsedForTests } from '../../../lib/mock/client';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// The mock server answers everything except payment, which is a spy here.
const confirmOrder = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: { ...mockApi, confirmOrder: (id: string) => confirmOrder(id) as unknown },
}));

const { ChatContainer } = await import('./ChatContainer');
const { handQuoteToChat } = await import('../hooks/useChat');

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ChatContainer />
    </QueryClientProvider>,
  );
}

describe('ChatContainer', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('draws the Main conversation from history', async () => {
    setup();
    expect(await screen.findByText('점심 시켜 줘. 따뜻한 걸로')).toBeInTheDocument();
    expect(screen.getByText('오늘 오후 12:28', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
  });

  it('puts the recommendation card under the dragon words, not at the screen edge', async () => {
    setup();
    const card = await screen.findByRole('button', { name: /돼지국밥 9,000원/ });
    const words = screen.getByText(/비 오니까 국물 어때용/).closest('p');
    // Main.dc.html: words and card share one column next to the small dragon.
    expect(words?.parentElement?.contains(card)).toBe(true);
  });

  it('draws the header and top it is given around the thread, input last', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChatContainer header={<h1>머리</h1>} top={<p>예산</p>} />
      </QueryClientProvider>,
    );
    const input = await screen.findByRole('textbox', { name: '용이에게 말하기' });
    const head = screen.getByRole('heading', { name: '머리' });
    const log = screen.getByRole('log');
    expect(head.compareDocumentPosition(screen.getByText('예산'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText('예산').compareDocumentPosition(log)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(log.compareDocumentPosition(input)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('picking a recommendation opens the sheet and does not pay', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /돼지국밥 9,000원/ }));
    const sheet = await screen.findByRole('dialog', { name: '주문 확인' });
    expect(within(sheet).getByRole('button', { name: /9,000원 시키기/ })).toBeInTheDocument();
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it('a quick reply goes to the dragon; its quote opens the sheet without paying', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: '돼지국밥으로' }));
    expect(await screen.findByText('돼지국밥으로')).toBeInTheDocument();
    await screen.findByRole('dialog', { name: '주문 확인' });
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it('a menu over the per-order limit opens the Blocked screen, not the sheet, and pays nothing', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /보쌈 정식/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/limit/order-bossam-set');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confirmOrder).not.toHaveBeenCalled();
  });

  it('"한도 올려 줘" puts the change card in the chat; only its button changes the limit', async () => {
    setup();
    await userEvent.type(await screen.findByRole('textbox'), '한도 5만 원까지 올려 줘');
    await userEvent.click(screen.getByRole('button', { name: /보내기/ }));
    const confirm = await screen.findByRole('button', { name: /Face ID로 확인하고 바꾸기/ });
    expect((await mockApi.getMe()).perOrderLimit).toBe(okrwToAokrw(10_000n).toString());
    await userEvent.click(confirm);
    expect(await screen.findByText(/이제 한 번에 50,000원까지/)).toBeInTheDocument();
    expect((await mockApi.getMe()).perOrderLimit).toBe(okrwToAokrw(50_000n).toString());
  });

  it('with the 30-day cap used up, picking a menu opens the Cap screen; no sheet, no payment', async () => {
    setMockChainUsedForTests(okrwToAokrw(55_000n)); // 55,000 + 9,000 > 60,000
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /돼지국밥 9,000원/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/limit/cap');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(confirmOrder).not.toHaveBeenCalled();
  });
  it('after a raise: opens the sheet the raise handed over and old cards drop 허락 필요 (user-flow 12)', async () => {
    await mockApi.createOrder({
      merchantId: 'hansang-bossam',
      items: [{ menuId: 'bossam-set', qty: 1 }],
      clientOrderId: 'c-raise',
    });
    await mockApi.setLimits({ perOrderLimit: okrwToAokrw(15_000n).toString() });
    const res = await mockApi.requoteOrder('order-bossam-set');
    expect(res.order.status).toBe('quoted');
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    if (res.quote) handQuoteToChat(qc, res.quote);
    render(
      <QueryClientProvider client={qc}>
        <ChatContainer />
      </QueryClientProvider>,
    );
    const sheet = await screen.findByRole('dialog', { name: '주문 확인' });
    expect(within(sheet).getAllByText(/보쌈/).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByText('허락 필요')).not.toBeInTheDocument();
    });
    expect(confirmOrder).not.toHaveBeenCalled();
  });
});
