import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { CapReached } from './CapReached';

// Harness states from docs/wiki/components/ui/limits/CapReached.md. Values from Cap.dc.html.
// 2026-12-03 14:00 KST = 05:00 UTC, as unix seconds (the chain's unit).
const RESET = Date.UTC(2026, 11, 3, 5, 0) / 1000;
const DAY = 86_400_000;

const meta = {
  title: 'limits/CapReached',
  component: CapReached,
  args: {
    resetAt: RESET,
    cap: okrwToAokrw(500_000n),
    onNotify: () => undefined,
    onDismiss: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapReached>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 며칠 남음 (Cap.dc.html: 4일 뒤) */
export const DaysLeft: Story = { args: { now: RESET * 1000 - 4 * DAY } };

/** 오늘 채워짐 */
export const Today: Story = { args: { now: RESET * 1000 - 3 * 60 * 60 * 1000 } };
