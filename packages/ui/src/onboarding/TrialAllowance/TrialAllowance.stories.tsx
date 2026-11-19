import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { useState } from 'react';
import { TrialAllowance, type TrialAllowanceStatus } from './TrialAllowance';

// Harness states from docs/wiki/components/ui/onboarding/TrialAllowance.md.
const meta = {
  title: 'onboarding/TrialAllowance',
  component: TrialAllowance,
  args: { amount: okrwToAokrw(100_000n), status: 'idle', onClaim: () => undefined },
  decorators: [(Story) => <div style={{ width: 350 }}>{Story()}</div>],
} satisfies Meta<typeof TrialAllowance>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 받기 전 (Budget 시안) */
export const Idle: Story = {};

/** 받는 중 */
export const Pending: Story = { args: { status: 'pending' } };

/** 받은 뒤 */
export const Done: Story = { args: { status: 'done' } };

function Claimable({ amount }: { amount: bigint }) {
  const [status, setStatus] = useState<TrialAllowanceStatus>('idle');
  return (
    <TrialAllowance
      amount={amount}
      status={status}
      onClaim={() => {
        setStatus('pending');
        setTimeout(() => {
          setStatus('done');
        }, 1000);
      }}
    />
  );
}

/** 눌러 보기: 1초 뒤 받은 뒤 모양 */
export const Flow: Story = {
  render: (args) => <Claimable amount={args.amount} />,
};
