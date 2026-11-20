import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { useState } from 'react';
import { AmountStepper, type AmountStepperProps } from './AmountStepper';

// Harness states from docs/wiki/components/ui/limits/AmountStepper.md. Values from Budget.dc.html.
const won = (n: bigint) => okrwToAokrw(n);

const meta = {
  title: 'limits/AmountStepper',
  component: AmountStepper,
  args: {
    label: '한 번에 쓸 돈',
    value: won(10_000n),
    min: won(5_000n),
    max: won(50_000n),
    step: won(5_000n),
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AmountStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live(props: AmountStepperProps) {
  const [value, setValue] = useState(props.value);
  return <AmountStepper {...props} value={value} onChange={setValue} />;
}

/** 한 번에 쓸 돈 (Budget.dc.html, 눌러서 굴러가는 숫자 확인) */
export const PerOrder: Story = { render: (args) => <Live {...args} /> };

/** 30일에 쓸 돈 (Budget.dc.html) */
export const MyPeriodic: Story = {
  args: {
    label: '30일에 쓸 돈',
    value: won(300_000n),
    min: won(50_000n),
    max: won(500_000n),
    step: won(50_000n),
  },
  render: (args) => <Live {...args} />,
};

/** 맨 아래 (− 흐리게) */
export const AtMin: Story = { args: { value: won(5_000n) } };

/** 맨 위 (+ 흐리게) */
export const AtMax: Story = { args: { value: won(50_000n) } };
