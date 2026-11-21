import type { Meta, StoryObj } from '@storybook/react-vite';
import { RetryLine } from './RetryLine';

// Harness states from docs/wiki/components/ui/base/RetryLine.md.
const meta = {
  title: 'base/RetryLine',
  component: RetryLine,
  args: { children: '주문 내역을 못 불러왔어요', onRetry: () => undefined },
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof RetryLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (주문 현황, 주문 상세, 한도 막대) */
export const Default: Story = {};

/** 라벨을 바꾼 것 */
export const CustomLabel: Story = { args: { retryLabel: '다시 해 볼까요' } };
