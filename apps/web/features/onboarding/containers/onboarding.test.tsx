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
const login = vi.fn();
const getAgentSetup = vi.fn();
vi.mock('../../../lib/api', () => ({
  api: {
    getMe: () => Promise.resolve(ME),
    getBudget: () => Promise.resolve(BUDGET),
    getSignupConfig: () => Promise.resolve(SIGNUP),
    createAgent: (b: unknown) => createAgent(b) as unknown,
    verifyIdentity: () => verifyIdentity() as unknown,
    setMonthlyBudget: (a: string) => setMonthlyBudget(a) as unknown,
    claimTrialAllowance: () => claimTrialAllowance() as unknown,
    login: (p: string) => login(p) as unknown,
    getAgentSetup: () => getAgentSetup() as unknown,
    retryAgentSetup: () => Promise.resolve(),
  },
}));

const { NameContainer } = await import('./NameContainer');
const { BudgetSetupContainer } = await import('./BudgetSetupContainer');
const { VerifyContainer } = await import('./VerifyContainer');
const { StartContainer } = await import('./StartContainer');
const { HatchContainer } = await import('./HatchContainer');

const won = (n: bigint) => okrwToAokrw(n).toString();

function wrap(ui: ReactNode, qc = newClient()) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  for (const f of [
    push,
    replace,
    createAgent,
    verifyIdentity,
    setMonthlyBudget,
    claimTrialAllowance,
    login,
    getAgentSetup,
  ]) {
    f.mockReset();
  }
});

describe('NameContainer', () => {
  it('draws the Name design: back, step 2 of 3, title, and the level 1 line under the field', async () => {
    wrap(<NameContainer />);
    expect(screen.getByRole('progressbar', { name: '3단계 중 2단계' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '알을 하나 골라이름을 지어 주세요',
    );
    expect(screen.getByRole('textbox', { name: '이름' })).toHaveAccessibleDescription(
      '레벨 1로 태어나요. 한 번에 10,000원까지.',
    );
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledExactlyOnceWith('/verify');
  });

  it.each(['', '   '])('an empty name (%j) explains and does not hatch', async (typed) => {
    wrap(<NameContainer />);
    const field = screen.getByRole('textbox', { name: '이름' });
    await userEvent.clear(field);
    if (typed !== '') await userEvent.type(field, typed);
    await userEvent.click(screen.getByRole('button', { name: '알 깨우기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이름을 지어 주세요');
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
    const take = await screen.findByRole('button', { name: '받기' });
    await userEvent.click(take);
    await userEvent.click(take);
    expect(take).toHaveAttribute('aria-busy', 'true');
    finish();
    // After it arrived the button is gone, so it cannot be asked for again.
    expect(await screen.findByText('받았어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '받기' })).toBeNull();
    expect(claimTrialAllowance).toHaveBeenCalledTimes(1);
  });

  it('greets with the 96px dragon and shows the trial allowance amount', async () => {
    const { container } = wrap(<BudgetSetupContainer />);
    expect(await screen.findByText('100,000원')).toBeInTheDocument();
    expect(container.querySelector('svg[width="96"]')).not.toBeNull();
  });
});

describe('VerifyContainer', () => {
  it('draws the Verify design: back, step 1 of 3 and the title', async () => {
    wrap(<VerifyContainer />);
    expect(screen.getByRole('progressbar', { name: '3단계 중 1단계' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '주인님이 누군지한 번만 확인할게요',
    );
    expect(await screen.findByText('실명 확인된 주인만 비서를 둘 수 있어요.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(replace).toHaveBeenCalledExactlyOnceWith('/start');
  });

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

describe('StartContainer', () => {
  it('draws the Start design: the forest egg, the title and the two sign-ins', async () => {
    login.mockResolvedValue(undefined);
    const { container } = wrap(<StartContainer />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('배달은용이한테 시켜용');
    expect(container.querySelector('svg[data-species="forest"][width="168"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /카카오로 시작하기/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /구글로 시작하기/ }));
    expect(login).toHaveBeenCalledWith('google');
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/verify');
    });
  });
});

describe('StartContainer and the me cache', () => {
  it('a login drops the signed-out answer kept from before, so the front door asks again', async () => {
    login.mockResolvedValue(undefined);
    const qc = newClient();
    qc.setQueryData(['me'], { stale: 'signed out' });
    wrap(<StartContainer />, qc);
    await userEvent.click(screen.getByRole('button', { name: /카카오로 시작하기/ }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/verify');
    });
    expect(qc.getQueryState(['me'])).toBeUndefined();
  });
});

describe('HatchContainer', () => {
  const steps = (s: readonly [string, string, string]) =>
    (['wallet', 'identity', 'limit'] as const).map((key, i) => ({ key, status: s[i] }));

  it('draws the hatch words and step labels while PENDING, and stays', async () => {
    getAgentSetup.mockResolvedValue({
      status: 'PENDING',
      steps: steps(['done', 'doing', 'waiting']),
    });
    wrap(<HatchContainer />);
    expect(
      await screen.findByRole('heading', { level: 1, name: '알이 흔들려용...' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1~3분 걸려요. 다 되면 알려 드릴게요.')).toBeInTheDocument();
    for (const label of [
      '용이 용돈 주머니 만들기',
      '용이 신분증 만들기',
      '한 번에 쓸 수 있는 돈 새기기',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(replace).not.toHaveBeenCalled();
  });

  it('moves on to /budget once the dragon is up', async () => {
    getAgentSetup.mockResolvedValue({ status: 'ACTIVE', steps: steps(['done', 'done', 'done']) });
    wrap(<HatchContainer />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/budget');
    });
  });
});
