import { okrwToAokrw } from '@sikyeoyong/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET, ME, SIGNUP } from '../../../lib/mock/fixtures';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));

// Reads come from the fixtures; every write is a spy.
const createAgent = vi.fn();
const verifyIdentity = vi.fn();
const setMonthlyBudget = vi.fn();
const claimTrialAllowance = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => Promise.resolve(BUDGET),
    getSignupConfig: () => Promise.resolve(SIGNUP),
    createAgent: (b: unknown) => createAgent(b) as unknown,
    verifyIdentity: () => verifyIdentity() as unknown,
    setMonthlyBudget: (a: string) => setMonthlyBudget(a) as unknown,
    claimTrialAllowance: () => claimTrialAllowance() as unknown,
  },
}));

const { NameContainer } = await import('./NameContainer');
const { BudgetSetupContainer } = await import('./BudgetSetupContainer');
const { VerifyContainer } = await import('./VerifyContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();

function wrap(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  for (const f of [
    push,
    replace,
    createAgent,
    verifyIdentity,
    setMonthlyBudget,
    claimTrialAllowance,
  ]) {
    f.mockReset();
  }
});

describe('NameContainer', () => {
  it.each(['', '   '])('an empty name (%j) explains and does not hatch', async (typed) => {
    wrap(<NameContainer />);
    const field = screen.getByRole('textbox', { name: '이름' });
    await userEvent.clear(field);
    if (typed !== '') await userEvent.type(field, typed);
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    expect(screen.getByText('이름을 지어 주세요')).toBeInTheDocument();
    expect(createAgent).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('hatches once with the trimmed name and the picked egg', async () => {
    createAgent.mockResolvedValue({ agent: { id: 'a1', status: 'PENDING' } });
    wrap(<NameContainer />);
    const field = screen.getByRole('textbox', { name: '이름' });
    await userEvent.clear(field);
    await userEvent.type(field, '  봄봄 ');
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    expect(createAgent).toHaveBeenCalledTimes(1);
    expect(createAgent).toHaveBeenCalledWith({ dragonName: '봄봄', dragonSpecies: 'forest' });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/hatch');
    });
  });
});

describe('BudgetSetupContainer', () => {
  it('saves the picked budget, as an aokrw string, once', async () => {
    setMonthlyBudget.mockResolvedValue(undefined);
    wrap(<BudgetSetupContainer />);
    await userEvent.click(await screen.findByRole('radio', { name: '500,000원' }));
    await userEvent.click(screen.getByRole('button', { name: '용이랑 시작하기' }));
    expect(setMonthlyBudget).toHaveBeenCalledTimes(1);
    expect(setMonthlyBudget).toHaveBeenCalledWith(won(500_000n));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/');
    });
  });

  it('takes the trial allowance once, however often 받기 is pressed', async () => {
    let finish: () => void = () => undefined;
    claimTrialAllowance.mockReturnValue(
      new Promise<void>((r) => {
        finish = r;
      }),
    );
    wrap(<BudgetSetupContainer />);
    const take = await screen.findByRole('button', { name: /받기/ });
    await userEvent.click(take);
    await userEvent.click(take);
    finish();
    await waitFor(() => {
      expect(take).not.toHaveAttribute('aria-busy');
    });
    await userEvent.click(take);
    expect(claimTrialAllowance).toHaveBeenCalledTimes(1);
  });
});

describe('VerifyContainer', () => {
  it('goes on to naming only when verified', async () => {
    verifyIdentity.mockResolvedValue({ verified: false });
    wrap(<VerifyContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /본인 인증/ }));
    await waitFor(() => {
      expect(verifyIdentity).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(push).not.toHaveBeenCalled();
  });

  it('verified moves to /name', async () => {
    verifyIdentity.mockResolvedValue({ verified: true });
    wrap(<VerifyContainer />);
    await userEvent.click(await screen.findByRole('button', { name: /본인 인증/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/name');
    });
  });
});
