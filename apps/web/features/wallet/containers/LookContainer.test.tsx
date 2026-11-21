import { AppError } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

const getMe = vi.fn();
const patchAgent = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => getMe() as unknown,
    patchAgent: (id: string, body: unknown) => patchAgent(id, body) as unknown,
  },
}));

const { LookContainer } = await import('./LookContainer');

function draw() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <LookContainer />
    </QueryClientProvider>,
  );
  return { qc, ...view };
}

beforeEach(() => {
  for (const f of [push, replace, getMe, patchAgent]) f.mockReset();
  getMe.mockResolvedValue({ ...ME, dragonSpecies: 'forest' });
  localStorage.clear();
  document.documentElement.dataset.species = 'forest';
});

describe('LookContainer (Look.dc.html, D-32)', () => {
  it('draws the design: back, title, the dragon with its name and line, four looks, the button', async () => {
    draw();
    expect(await screen.findByRole('heading', { name: '용이 모습' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument();
    expect(await screen.findByText('"천천히 먹어용"')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '숲용' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: '이 모습으로 바꾸기' })).toBeInTheDocument();
  });

  it('keeps the header and back while /me loads, and shows a retry when it fails', async () => {
    getMe.mockReturnValue(new Promise(() => undefined));
    const first = draw();
    expect(screen.getByRole('heading', { name: '용이 모습' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledWith('/dragon');
    first.unmount();
    getMe.mockReset();
    getMe.mockRejectedValueOnce(new AppError('INTERNAL'));
    draw();
    expect(await screen.findByText('용이를 못 불러왔어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument();
    getMe.mockResolvedValue({ ...ME, dragonSpecies: 'forest' });
    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByRole('radio', { name: '숲용' })).toBeInTheDocument();
  });

  it('a pick changes the dragon, its line and the app color at once, without saving', async () => {
    draw();
    await userEvent.click(await screen.findByRole('radio', { name: '물용' }));
    expect(screen.getByText('"국물이 최고예용"')).toBeInTheDocument();
    expect(document.documentElement.dataset.species).toBe('water');
    expect(localStorage.getItem('sikyeoyong.species')).toBeNull();
    expect(patchAgent).not.toHaveBeenCalled();
  });

  it('leaving without saving puts the saved look back', async () => {
    const { unmount } = draw();
    await userEvent.click(await screen.findByRole('radio', { name: '별용' }));
    expect(document.documentElement.dataset.species).toBe('star');
    unmount();
    expect(document.documentElement.dataset.species).toBe('forest');
  });

  it('saves the pick once with the agent id from /me, updates /me and goes back to the Wallet', async () => {
    // Like the server: once saved, GET /me answers the new look.
    patchAgent.mockImplementation(() => {
      getMe.mockResolvedValue({ ...ME, dragonSpecies: 'flower' });
      return Promise.resolve({ dragonSpecies: 'flower' });
    });
    const { qc, unmount } = draw();
    await userEvent.click(await screen.findByRole('radio', { name: '꽃용' }));
    await userEvent.click(screen.getByRole('button', { name: '이 모습으로 바꾸기' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/dragon');
    });
    expect(patchAgent).toHaveBeenCalledTimes(1);
    expect(patchAgent).toHaveBeenCalledWith(ME.agentId, { dragonSpecies: 'flower' });
    expect(qc.getQueryData<typeof ME>(['me'])?.dragonSpecies).toBe('flower');
    expect(localStorage.getItem('sikyeoyong.species')).toBe('flower');
    unmount();
    expect(document.documentElement.dataset.species).toBe('flower');
  });

  it('the same look just goes back, no request (user-flow 18)', async () => {
    draw();
    await userEvent.click(await screen.findByRole('button', { name: '이 모습으로 바꾸기' }));
    expect(replace).toHaveBeenCalledWith('/dragon');
    expect(patchAgent).not.toHaveBeenCalled();
  });

  it('a refused save says so in one line and stays, keeping the pick', async () => {
    patchAgent.mockRejectedValue(new AppError('INTERNAL'));
    draw();
    await userEvent.click(await screen.findByRole('radio', { name: '물용' }));
    await userEvent.click(screen.getByRole('button', { name: '이 모습으로 바꾸기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('모습을 못 바꿨어요');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '물용' })).toHaveAttribute('aria-checked', 'true');
  });
});
