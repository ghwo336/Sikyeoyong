import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../../lib/mock/client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// The mock server answers everything except payment, which is a spy here.
const confirmOrder = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: { ...mockApi, confirmOrder: (id: string) => confirmOrder(id) as unknown },
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

describe('ChatContainer', () => {
  it('draws the Main conversation from history', async () => {
    setup();
    expect(await screen.findByText('점심 시켜 줘. 따뜻한 걸로')).toBeInTheDocument();
    expect(screen.getByText('오늘 오후 12:28', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
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

  it('a new store needing approval opens nothing', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /보쌈 정식/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(confirmOrder).not.toHaveBeenCalled();
  });
});
