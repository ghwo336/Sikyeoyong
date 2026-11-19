import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepProgress } from './StepProgress';

// Harness states from docs/wiki/components/ui/base/StepProgress.md.
const meta = {
  title: 'base/StepProgress',
  component: StepProgress,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StepProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

const SIGNUP = ['본인 확인', '알 고르기', '예산'];
const ORDER = ['주문 접수', '조리 중', '배달 중', '도착'];

/** 가입 1/3 (Verify.dc.html) */
export const SignupFirst: Story = {
  args: { steps: SIGNUP, current: 1 },
};

/** 주문 조리 중 (Done.dc.html) */
export const OrderCooking: Story = {
  args: { steps: ORDER, current: 2, showLabels: true, size: 'md' },
};

/** 모두 완료 (Arrived.dc.html) */
export const AllDone: Story = {
  args: { steps: ORDER, current: 4, size: 'md' },
};
