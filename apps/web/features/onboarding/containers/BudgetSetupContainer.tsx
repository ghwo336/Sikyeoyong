'use client';

import { dragonStage, parseAokrw } from '@sikyeoyong/shared';
import { Button, DragonLine, StepProgress, TopBar, TrialAllowance } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { LimitSteppers } from '../../limits/containers/LimitSteppers';
import { limitsBody } from '../../limits/draft';
import { useLimitDraft } from '../../limits/hooks/useLimitDraft';
import { useSetLimits } from '../../limits/hooks/useSetLimits';
import { useMe } from '../../me/hooks/useMe';
import { useClaimTrialAllowance, useSignupConfig } from '../hooks/useSignup';
import { clearBudgetStepPending, isBudgetStepPending } from '../pending-budget';
import { nameIs, SIGNUP_STEPS } from '../steps';

/**
 * Budget.dc.html (D-31): how much the dragon may spend at once and in 30 days, the trial
 * allowance, then the chat. The dragon grows with the per-order amount. Only what changed is
 * sent; the server writes the per-order one to the chain.
 */
export function BudgetSetupContainer() {
  const router = useRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const config = useSignupConfig().data;
  const save = useSetLimits();
  const claim = useClaimTrialAllowance();
  const { draft, setPerOrder, setMyPeriodic } = useLimitDraft(budget);
  // Sign-up only: someone already set up opening /budget goes to the dragon screen.
  const onboarded = me !== undefined && !isBudgetStepPending();
  useEffect(() => {
    if (onboarded) router.replace('/dragon');
  }, [onboarded, router]);
  if (onboarded || !me || !budget || !draft || !config) {
    return <TopBar trailing={<StepProgress steps={SIGNUP_STEPS} current={3} />} />;
  }
  const start = () => {
    const body = limitsBody(budget, draft);
    if (Object.keys(body).length === 0) {
      clearBudgetStepPending();
      router.push('/');
      return;
    }
    save.mutate(body, {
      onSuccess: () => {
        clearBudgetStepPending();
        router.push('/');
      },
    });
  };
  return (
    <>
      <TopBar trailing={<StepProgress steps={SIGNUP_STEPS} current={3} />} />
      <DragonLine
        text={`안녕하세용!\n${nameIs(me.dragonName)}. 얼마까지 맡겨 줄래용?`}
        layout="greeting"
        species={me.dragonSpecies}
        stage={dragonStage(draft.perOrder)}
      />
      <LimitSteppers draft={draft} onPerOrder={setPerOrder} onMyPeriodic={setMyPeriodic} />
      <TrialAllowance
        amount={parseAokrw(config.trialAllowance)}
        status={claim.isSuccess ? 'done' : claim.isPending ? 'pending' : 'idle'}
        onClaim={() => {
          // Once only: TrialAllowance calls this only while idle, and the server must also
          // take a second call as the same claim (web.md "남은 일").
          if (claim.isPending || claim.isSuccess) return;
          claim.mutate();
        }}
      />
      <Button variant="primary" loading={save.isPending} onPress={start}>
        용이랑 시작하기
      </Button>
    </>
  );
}
