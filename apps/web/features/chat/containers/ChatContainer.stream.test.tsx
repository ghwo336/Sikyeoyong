import type { ChatEvent } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockSession } from '../../../lib/mock/client';

const push = vi.fn();
const asked = { approvals: 0, orders: 0 };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

// The dragon's answer is driven by hand: events go out one by one, then the stream ends.
let emit: (e: ChatEvent) => void = () => undefined;
let finish: (all: ChatEvent[]) => void = () => undefined;
vi.mock('../../../lib/api', () => ({
  api: {
    ...mockApi,
    listApprovals: () => {
      asked.approvals += 1;
      return mockApi.listApprovals();
    },
    listOrders: () => {
      asked.orders += 1;
      return mockApi.listOrders();
    },
    sendChatMessage: (_body: unknown, onEvent?: (e: ChatEvent) => void) =>
      new Promise<ChatEvent[]>((resolve) => {
        emit = (e) => onEvent?.(e);
        finish = resolve;
      }),
  },
}));

const { ChatContainer } = await import('./ChatContainer');

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ChatContainer />
    </QueryClientProvider>,
  );
}

async function say(text: string) {
  await userEvent.type(await screen.findByRole('textbox'), text);
  await userEvent.click(screen.getByRole('button', { name: /보내기/ }));
}

describe('ChatContainer while the dragon writes (D-23)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
    push.mockReset();
    asked.approvals = 0;
    asked.orders = 0;
  });

  async function turnWith(reason: 'NEW_MERCHANT' | 'OVER_LEVEL_LIMIT') {
    setup();
    await say('한상보쌈 시켜 줘');
    await screen.findByRole('status', { name: '용이가 답을 쓰고 있어요' });
    await waitFor(() => {
      expect(asked.orders).toBeGreaterThan(0);
    });
    const before = { ...asked };
    const events: ChatEvent[] = [
      { type: 'approval_request', orderId: 'o9', reason },
      { type: 'done', messageId: 'm9' },
    ];
    act(() => {
      finish(events);
    });
    return before;
  }

  it('an approval_request asks the approvals and orders again so the card shows at once (QA 6)', async () => {
    const before = await turnWith('NEW_MERCHANT');
    await waitFor(() => {
      expect(asked.approvals).toBeGreaterThan(before.approvals);
      expect(asked.orders).toBeGreaterThan(before.orders);
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('a wait on the per-order limit opens the Blocked screen for that order', async () => {
    await turnWith('OVER_LEVEL_LIMIT');
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/limit/o9');
    });
  });

  it('shows the typing dots until the first words, then the words as they arrive', async () => {
    setup();
    await say('저녁 추천해 줘');
    expect(
      await screen.findByRole('status', { name: '용이가 답을 쓰고 있어요' }),
    ).toBeInTheDocument();
    act(() => {
      emit({ type: 'token', text: '비 오니까 ' });
    });
    expect(await screen.findByText('비 오니까')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '용이가 답을 쓰고 있어요' })).toBeNull();
    act(() => {
      emit({ type: 'token', text: '국물 어때용?' });
    });
    expect(await screen.findByText('비 오니까 국물 어때용?')).toBeInTheDocument();
    const all: ChatEvent[] = [
      { type: 'token', text: '비 오니까 ' },
      { type: 'token', text: '국물 어때용?' },
      { type: 'done', messageId: 'm9' },
    ];
    act(() => {
      finish(all);
    });
    // The finished answer replaces the one being written: the line appears once.
    await waitFor(() => {
      expect(screen.getAllByText('비 오니까 국물 어때용?')).toHaveLength(1);
    });
  });
});
