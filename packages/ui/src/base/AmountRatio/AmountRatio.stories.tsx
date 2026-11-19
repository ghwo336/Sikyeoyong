import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { AmountRatio } from './AmountRatio';

// Harness states from docs/wiki/components/ui/base/AmountRatio.md.
const meta = {
  title: 'base/AmountRatio',
  component: AmountRatio,
  decorators: [(Story) => <div style={{ width: 342, textAlign: 'center' }}>{Story()}</div>],
} satisfies Meta<typeof AmountRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

const won = (n: bigint) => okrwToAokrw(n);

/** 막대 위 숫자 (meter, 값 뒤 원 없음) */
export const Meter: Story = {
  args: { value: won(210_000n), max: won(300_000n), size: 'meter', valueUnit: false },
  decorators: [(Story) => <div style={{ fontSize: 13 }}>{Story()}</div>],
};

/** 막힘 (blocked, 까지) */
export const Blocked: Story = {
  args: { value: won(45_000n), max: won(10_000n), size: 'blocked', suffix: '까지' },
};

/** 아주 큰 금액 (줄바꿈) */
export const Huge: Story = {
  args: {
    value: won(123_456_789_012_345_678n),
    max: won(10_000n),
    size: 'blocked',
    suffix: '까지',
  },
};
