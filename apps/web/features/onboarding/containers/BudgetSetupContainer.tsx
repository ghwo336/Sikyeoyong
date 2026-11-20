'use client';

import { dragonStage, parseAokrw } from '@sikyeoyong/shared';
import {
  AmountStepper,
  Button,
  DragonLine,
  StepProgress,
  TopBar,
  TrialAllowance,
} from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { useSetLimits } from '../../limits/hooks/useSetLimits';
import { useMe } from '../../me/hooks/useMe';
import { useClaimTrialAllowance, useSignupConfig } from '../hooks/useSignup';
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
  const [perOrder, setPerOrder] = useState<bigint | undefined>(undefined);
  const [myPeriodic, setMyPeriodic] = useState<bigint | undefined>(undefined);
  if (!me || !budget || !config) {
    return <TopBar trailing={<StepProgress steps={SIGNUP_STEPS} current={3} />} />;
  }
  const savedPerOrder = parseAokrw(budget.perOrderLimit);
  const savedMyPeriodic = parseAokrw(budget.myPeriodicLimit);
  const perOrderNow = perOrder ?? savedPerOrder;
  const myPeriodicNow = myPeriodic ?? savedMyPeriodic;
  const ranges = budget.limitRanges;
  const start = () => {
    const body = {
      ...(perOrderNow === savedPerOrder ? {} : { perOrderLimit: perOrderNow.toString() }),
      ...(myPeriodicNow === savedMyPeriodic ? {} : { myPeriodicLimit: myPeriodicNow.toString() }),
    };
    if (Object.keys(body).length === 0) {
      router.push('/');
      return;
    }
    save.mutate(body, {
      onSuccess: () => {
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
        stage={dragonStage(perOrderNow)}
      />
      <AmountStepper
        label="한 번에 쓸 돈"
        value={perOrderNow}
        min={parseAokrw(ranges.perOrder.min)}
        max={parseAokrw(ranges.perOrder.max)}
        step={parseAokrw(ranges.perOrder.step)}
        onChange={setPerOrder}
      />
      <AmountStepper
        label="30일에 쓸 돈"
        value={myPeriodicNow}
        min={parseAokrw(ranges.myPeriodic.min)}
        max={parseAokrw(ranges.myPeriodic.max)}
        step={parseAokrw(ranges.myPeriodic.step)}
        onChange={setMyPeriodic}
      />
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
