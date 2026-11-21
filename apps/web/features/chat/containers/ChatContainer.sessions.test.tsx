import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatHistory, OrderQuote } from '@sikyeoyong/shared';
import { mockApi, resetMockSession } from '../../../lib/mock/client';

// D-34: only this meal is drawn in full. Earlier meals fold above as text, and a finished
// meal gives way to the dragon's greeting.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const getChatHistory = vi.fn<() => Promise<ChatHistory>>();
const sendChatMessage = vi.fn<() => Promise<unknown[]>>();
const listOrders = vi.fn<() => ReturnType<typeof mockApi.listOrders>>();
vi.mock('../../../lib/api', () => ({
  api: {
    ...mockApi,
    getChatHistory: () => getChatHistory(),
    listOrders: () => listOrders(),
    sendChatMessage: () => sendChatMessage(),
    getOpenQuote: () => Promise.resolve({}),
  },
}));

const { ChatContainer } = await import('./ChatContainer');

// 2026-11-21 18:30 KST, the evening before "now" in these tests.
const THEN = Date.UTC(2026, 10, 21, 9, 30);
const quote: OrderQuote = {
  orderId: 'o1',
  store: '마루국밥',
  destination: '집',
  etaMin: 20,
  items: [{ name: '돼지국밥', quantity: 1, price: '9000000000000000000000' }],
  amount: '9000000000000000000000',
  dragonLine: '확인해 주세용',
  perOrderLimit: '20000000000000000000000',
  periodUsedAfter: '9000000000000000000000',
  periodCap: '300000000000000000000000',
};

const yesterday: ChatHistory = {
  startedAt: THEN,
  nextCursor: null,
  messages: [
    { id: 'm1', role: 'user', text: '저녁 시켜 줘', sessionId: 's1', createdAt: THEN },
    {
      id: 'm2',
      role: 'dragon',
      sessionId: 's1',
      createdAt: THEN,
      events: [
        { type: 'token', text: '이거 어때용?' },
        { type: 'order_confirm', quote },
        { type: 'done', messageId: 'm2' },
      ],
    },
  ],
};

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <ChatContainer />
    </QueryClientProvider>,
  );
}

const done = async (status: 'delivered' | 'delivering') => {
  const base = await mockApi.listOrders();
  return { orders: [{ ...(base.orders[0] ?? {}), id: 'o1', status }] } as never;
};

describe('ChatContainer sessions (D-34)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
    vi.useRealTimers();
  });

  it('folds a finished meal above and greets first, with no button on the old card', async () => {
    getChatHistory.mockResolvedValue(yesterday);
    listOrders.mockResolvedValue(await done('delivered'));
    setup();
    const log = await screen.findByRole('log');
    expect(await within(log).findByText('11월 21일 저녁')).toBeInTheDocument();
    expect(within(log).getByText('돼지국밥 9,000원, 도착함')).toBeInTheDocument();
    // The old meal's words are not drawn in full.
    expect(within(log).queryByText('저녁 시켜 줘')).toBeNull();
    // The greeting follows the folded meal, from the meal of the moment.
    expect(within(log).getByText(/시켜 줄까용\?$/)).toBeInTheDocument();
    // Nothing in the thread can pay or pick.
    expect(within(log).queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps a meal whose order is still on its way as the current conversation', async () => {
    // Minutes ago, so the idle limit has not passed either.
    const now = Date.now() - 60_000;
    getChatHistory.mockResolvedValue({
      ...yesterday,
      messages: yesterday.messages.map((m) => ({ ...m, createdAt: now })),
    });
    listOrders.mockResolvedValue(await done('delivering'));
    setup();
    const log = await screen.findByRole('log');
    expect(await within(log).findByText('저녁 시켜 줘')).toBeInTheDocument();
    expect(within(log).queryByText('11월 21일 저녁')).toBeNull();
    expect(within(log).queryByText(/시켜 줄까용\?$/)).toBeNull();
  });

  it('greets a first conversation, and the greeting stays above what the user sends', async () => {
    getChatHistory.mockResolvedValue({ startedAt: THEN, nextCursor: null, messages: [] });
    listOrders.mockResolvedValue({ orders: [] });
    setup();
    const greeting = await screen.findByText(/시켜 줄까용\?$/);
    await userEvent.type(screen.getByRole('textbox', { name: '용이에게 말하기' }), '국밥{Enter}');
    const sent = await screen.findByText('국밥');
    await waitFor(() => {
      expect(
        greeting.compareDocumentPosition(sent) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('scrolls to the bottom when the user sends, as before', async () => {
    getChatHistory.mockResolvedValue(yesterday);
    listOrders.mockResolvedValue(await done('delivered'));
    setup();
    const log = await screen.findByRole('log');
    await within(log).findByText(/시켜 줄까용\?$/);
    Object.defineProperty(log, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(log, 'scrollHeight', {
      configurable: true,
      get: () => log.children.length * 100,
    });
    log.scrollTop = 0;
    await userEvent.type(screen.getByRole('textbox', { name: '용이에게 말하기' }), '국밥{Enter}');
    await screen.findByText('국밥');
    await waitFor(() => {
      expect(log.scrollTop).toBe(log.children.length * 100);
    });
  });
});

describe('ChatContainer failures', () => {
  beforeEach(() => {
    resetMockSession('hatched');
    sendChatMessage.mockReset();
  });

  it('a failed send keeps the bubble, marks it failed and sends again with the button', async () => {
    getChatHistory.mockResolvedValue({ startedAt: THEN, nextCursor: null, messages: [] });
    listOrders.mockResolvedValue({ orders: [] });
    sendChatMessage.mockRejectedValueOnce(new Error('network'));
    setup();
    await screen.findByText(/시켜 줄까용\?$/);
    await userEvent.type(screen.getByRole('textbox', { name: '용이에게 말하기' }), '국밥{Enter}');
    expect(await screen.findByText('국밥')).toBeInTheDocument();
    expect(await screen.findByText('못 보냈어요')).toBeInTheDocument();
    sendChatMessage.mockResolvedValueOnce([{ type: 'done', messageId: 'r' }]);
    await userEvent.click(screen.getByRole('button', { name: '다시 보내기' }));
    await waitFor(() => {
      expect(screen.queryByText('못 보냈어요')).toBeNull();
    });
    expect(sendChatMessage).toHaveBeenCalledTimes(2);
  });

  it('a failed history shows a retry line instead of an empty screen, and retry loads it', async () => {
    getChatHistory.mockRejectedValueOnce(new Error('500'));
    listOrders.mockResolvedValue({ orders: [] });
    setup();
    expect(await screen.findByText('대화를 못 불러왔어요')).toBeInTheDocument();
    // Sending now has no thread to land in: nothing is lost, the draft stays.
    const box = screen.getByRole('textbox', { name: '용이에게 말하기' });
    await userEvent.type(box, '국밥{Enter}');
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(box).toHaveValue('국밥');
    getChatHistory.mockResolvedValue({ startedAt: THEN, nextCursor: null, messages: [] });
    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText(/시켜 줄까용\?$/)).toBeInTheDocument();
    expect(screen.queryByText('대화를 못 불러왔어요')).toBeNull();
  });
});
