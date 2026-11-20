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

/** 기본: 한 번에 45,000원으로 올리고 시키기 (Blocked.dc.html, D-12 장면 4) */
export const Default: Story = { args: { raiseTo: won(45_000n) } };

/** 올려도 안 들어감 (한 번에 한도의 맨 위보다 큰 주문) */
export const CannotRaise: Story = { args: { attempted: won(62_000n), limit: won(50_000n) } };
