'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { BudgetPicker, Button, DragonLine, ListRow, StepProgress, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { useMe } from '../../me/hooks/useMe';
import { useClaimTrialAllowance, useSetMonthlyBudget, useSignupConfig } from '../hooks/useSignup';
import { nameIs, SIGNUP_STEPS } from '../steps';

/** Budget.dc.html: this month's budget, the trial allowance, then the chat. */
export function BudgetSetupContainer() {
  const router = useRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const config = useSignupConfig().data;
  const save = useSetMonthlyBudget();
  const claim = useClaimTrialAllowance();
  const [picked, setPicked] = useState<bigint | undefined>(undefined);
  if (!me || !budget || !config) {
    return <TopBar trailing={<StepProgress steps={SIGNUP_STEPS} current={3} />} />;
  }
  const options = budget.budgetOptions.map((o) => parseAokrw(o.amount));
  const value = picked ?? parseAokrw(budget.personalBudget);
  return (
    <>
      <TopBar trailing={<StepProgress steps={SIGNUP_STEPS} current={3} />} />
      <DragonLine
        text={`안녕하세용!\n${nameIs(me.dragonName)}. 이번 달엔 얼마까지 시킬까용?`}
        layout="inline"
        species={me.dragonSpecies}
      />
      <BudgetPicker options={options} value={value} onChange={setPicked} />
      <ListRow
        label="체험용 용돈"
        value={formatOkrw(parseAokrw(config.trialAllowance))}
        trailing={
          <Button
            variant="secondary"
            size="md"
            loading={claim.isPending}
            onPress={() => {
              // Once only: a second tap while it runs or after it worked does nothing.
              if (claim.isPending || claim.isSuccess) return;
              claim.mutate();
            }}
          >
            받기
          </Button>
        }
      />
      <Button
        variant="primary"
        loading={save.isPending}
        onPress={() => {
          save.mutate(value.toString(), {
            onSuccess: () => {
              router.push('/');
            },
          });
        }}
      >
        용이랑 시작하기
      </Button>
    </>
  );
}
