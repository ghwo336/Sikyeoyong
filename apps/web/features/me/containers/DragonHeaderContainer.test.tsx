import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../../lib/api', () => ({
  // Not the design values (level 1, 10,000원), so a hard-coded caption cannot pass.
  api: {
    getMe: () =>
      Promise.resolve({
        ...ME,
        dragonName: '봄봄',
        dragonSpecies: 'water',
        level: 2,
        perOrderLimit: aokrwToString(okrwToAokrw(30_000n)),
      }),
  },
}));

const { DragonHeaderContainer } = await import('./DragonHeaderContainer');

describe('DragonHeaderContainer', () => {
  it('shows the dragon from /me with its level line and opens settings', async () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DragonHeaderContainer />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: '봄봄' })).toBeInTheDocument();
    expect(screen.getByText('레벨 2, 한 번에 30,000원까지')).toBeInTheDocument();
    expect(container.querySelector('svg[data-species="water"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '봄봄 설정' }));
    expect(push).toHaveBeenCalledWith('/dragon');
  });
});
