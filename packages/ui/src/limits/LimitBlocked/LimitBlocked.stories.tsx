import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { LimitBlocked } from './LimitBlocked';

// Harness states from docs/wiki/components/ui/limits/LimitBlocked.md. Values from Blocked.dc.html.
const won = (n: bigint) => okrwToAokrw(n);

const meta = {
  title: 'limits/LimitBlocked',
  component: LimitBlocked,
  args: {
    attempted: won(45_000n),
    limit: won(10_000n),
    onRaise: () => undefined,
    onRepick: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LimitBlocked>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (Blocked.dc.html) */
export const Default: Story = { args: { nextLevel: { level: 3, limit: won(50_000n) } } };

/** 다음 레벨 없음 (최고 레벨) */
export const TopLevel: Story = { args: { attempted: won(320_000n), limit: won(300_000n) } };
