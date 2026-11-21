import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { LeakCompare } from './LeakCompare';

// Harness states from docs/wiki/components/ui/wallet/LeakCompare.md. Values from LeakCompare.dc.html.
const meta = {
  title: 'wallet/LeakCompare',
  component: LeakCompare,
  args: {
    perOrderLimit: okrwToAokrw(10_000n),
    periodicCap: okrwToAokrw(60_000n),
    periodSec: 3_600,
    floatAtRisk: okrwToAokrw(20_100n),
    pocket: okrwToAokrw(20_000n),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeakCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 데모 프로필 (1시간 60,000원, 시안 값) */
export const Default: Story = {};
/** 기본 프로필 (30일 500,000원) */
export const ThirtyDays: Story = {
  args: { periodSec: 2_592_000, periodicCap: okrwToAokrw(500_000n) },
};
/** 건당 한도 50,000원 */
export const Large: Story = {
  args: {
    perOrderLimit: okrwToAokrw(50_000n),
    floatAtRisk: okrwToAokrw(100_100n),
    pocket: 0n,
  },
};
/** 자세히 보기 켬 */
export const Detailed: Story = { args: { detailed: true } };
