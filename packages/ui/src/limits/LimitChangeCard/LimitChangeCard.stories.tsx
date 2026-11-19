import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { LimitChangeCard } from './LimitChangeCard';

// Harness states from docs/wiki/components/ui/limits/LimitChangeCard.md. Values from LimitChat.dc.html.
const won = (n: bigint) => okrwToAokrw(n);

const meta = {
  title: 'limits/LimitChangeCard',
  component: LimitChangeCard,
  args: {
    field: 'perOrder',
    from: won(10_000n),
    to: won(50_000n),
    levelFrom: 1,
    levelTo: 3,
    needsReauth: true,
    rows: [{ label: '30일 한도', value: '500,000원 그대로' }],
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 308 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LimitChangeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 올리기 (재인증, LimitChat.dc.html) */
export const RaiseWithReauth: Story = {};

/** 내리기 (바로) */
export const Lower: Story = {
  args: { from: won(50_000n), to: won(10_000n), levelFrom: 3, levelTo: 1, needsReauth: false },
};

/** 확인 중 */
export const Confirming: Story = { args: { status: 'confirming' } };

/** 실패 */
export const Failed: Story = { args: { status: 'failed' } };
