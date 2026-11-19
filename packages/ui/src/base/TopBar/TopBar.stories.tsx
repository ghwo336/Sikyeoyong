import type { Meta, StoryObj } from '@storybook/react-vite';
import { StepProgress } from '../StepProgress';
import { TopBar } from './TopBar';

// Harness states from docs/wiki/components/ui/base/TopBar.md.
const meta = {
  title: 'base/TopBar',
  component: TopBar,
  decorators: [
    (Story) => (
      <div style={{ width: 350, padding: '0 20px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const back = () => undefined;
const SIGNUP = ['본인 확인', '알 고르기', '예산'];

/** 뒤로만 (Frozen.dc.html) */
export const BackOnly: Story = {
  args: { onBack: back },
};

/** 제목 (Receipt.dc.html) */
export const WithTitle: Story = {
  args: { onBack: back, title: '주문 상세' },
};

/** 단계 표시 포함 (Name.dc.html) */
export const WithSteps: Story = {
  args: { onBack: back, trailing: <StepProgress steps={SIGNUP} current={2} /> },
};

/** 단계 표시, 뒤로 없음 (Budget.dc.html) */
export const StepsNoBack: Story = {
  args: { trailing: <StepProgress steps={SIGNUP} current={3} /> },
};

/** Done.dc.html: 대화로 돌아가기와 제목 */
export const BackToChat: Story = {
  args: { onBack: back, backLabel: '대화로 돌아가기', title: '주문 현황' },
};
