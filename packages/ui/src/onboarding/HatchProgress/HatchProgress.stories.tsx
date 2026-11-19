import type { Meta, StoryObj } from '@storybook/react-vite';
import { type HatchStep, HatchProgress } from './HatchProgress';

// Harness states from docs/wiki/components/ui/onboarding/HatchProgress.md. Labels from Hatch.dc.html.
const LABELS = ['용이 용돈 주머니 만들기', '용이 신분증 만들기', '한 번에 쓸 수 있는 돈 새기기'];
const steps = (...s: HatchStep['status'][]) =>
  LABELS.map((label, i) => ({ label, status: s[i] ?? 'waiting' }));

const meta = {
  title: 'onboarding/HatchProgress',
  component: HatchProgress,
  args: { steps: steps('doing', 'waiting', 'waiting'), onRetry: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HatchProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 처음 */
export const Start: Story = {};

/** 신분증 중 (Hatch.dc.html) */
export const IdCardDoing: Story = { args: { steps: steps('done', 'doing', 'waiting') } };

/** 모두 완료 */
export const AllDone: Story = { args: { steps: steps('done', 'done', 'done') } };

/** 실패와 다시 깨우기 */
export const Failed: Story = { args: { steps: steps('done', 'failed', 'waiting') } };
