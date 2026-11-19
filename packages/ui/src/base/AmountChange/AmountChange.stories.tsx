import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { AmountChange } from './AmountChange';

// Harness states from docs/wiki/components/ui/base/AmountChange.md.
const meta = {
  title: 'base/AmountChange',
  component: AmountChange,
  decorators: [(Story) => <div style={{ width: 318 }}>{Story()}</div>],
} satisfies Meta<typeof AmountChange>;

export default meta;
type Story = StoryObj<typeof meta>;

const won = (n: bigint) => okrwToAokrw(n);

/** 올리기 (1만 원에서 5만 원) */
export const Raise: Story = { args: { from: won(10_000n), to: won(50_000n) } };

/** 내리기 (30만 원에서 20만 원) */
export const Lower: Story = { args: { from: won(300_000n), to: won(200_000n) } };

/** 아주 큰 금액 */
export const Huge: Story = { args: { from: won(10_000n), to: won(123_456_789_012_345_678n) } };
