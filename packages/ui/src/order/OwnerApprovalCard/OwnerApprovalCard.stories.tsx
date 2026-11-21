import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { OwnerApprovalCard } from './OwnerApprovalCard';

// Harness states from docs/wiki/components/ui/order/OwnerApprovalCard.md.
const meta = {
  title: 'order/OwnerApprovalCard',
  component: OwnerApprovalCard,
  args: {
    reason: 'NEW_MERCHANT',
    store: '한상보쌈',
    amount: okrwToAokrw(12_000n),
    onApprove: () => undefined,
    onReject: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OwnerApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 처음 시키는 가게 */
export const NewStore: Story = {};

/** 30일에 쓸 돈을 넘음 */
export const OverBudget: Story = {
  args: { reason: 'OVER_PERSONAL_BUDGET', store: '마루국밥 본점', amount: okrwToAokrw(9_000n) },
};

/** 허락하는 중 (버튼에 돌아가는 표시, 둘 다 눌리지 않음) */
export const Approving: Story = { args: { status: 'approving' } };

/** 안 시키는 중 */
export const Rejecting: Story = { args: { status: 'rejecting' } };

/** 답이 가지 못함 (같은 버튼으로 다시) */
export const Failed: Story = { args: { status: 'failed' } };

/** 종 테마와 상관없이 같은 색 (D-32) */
export const StarSpecies: Story = {
  decorators: [
    (Story) => (
      <div data-species="star">
        <Story />
      </div>
    ),
  ],
};
