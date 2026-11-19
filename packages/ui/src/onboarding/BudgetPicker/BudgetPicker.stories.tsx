import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { useState } from 'react';
import { BudgetPicker } from './BudgetPicker';

// Harness states from docs/wiki/components/ui/onboarding/BudgetPicker.md. Options from Budget.dc.html.
const OPTIONS = [200_000n, 300_000n, 500_000n].map(okrwToAokrw);

const meta = {
  title: 'onboarding/BudgetPicker',
  component: BudgetPicker,
  args: { options: OPTIONS, value: okrwToAokrw(300_000n), onChange: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BudgetPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial }: { initial: bigint }) {
  const [value, setValue] = useState(initial);
  return <BudgetPicker options={OPTIONS} value={value} onChange={setValue} />;
}

/** 30만 선택 (Budget.dc.html. 표기는 Q-23 결론 전까지 "300,000원") */
export const Thirty: Story = { render: () => <Live initial={okrwToAokrw(300_000n)} /> };

/** 다른 값 선택 */
export const Fifty: Story = { render: () => <Live initial={okrwToAokrw(500_000n)} /> };
