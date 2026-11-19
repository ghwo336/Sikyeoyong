import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorLine } from './ErrorLine';

// Harness states from docs/wiki/components/ui/base/ErrorLine.md.
const meta = {
  title: 'base/ErrorLine',
  component: ErrorLine,
  args: { children: '못 바꿨어요. 다시 해 볼까요?' },
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof ErrorLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 왼쪽 정렬 (한도 바꾸기, 입력칸 아래) */
export const Start: Story = {};

/** 가운데 정렬 (본인 인증 버튼 위) */
export const Center: Story = {
  args: { align: 'center', children: '인증이 안 됐어요. 다시 해 주세요.' },
};

/** 긴 문구 (가격 변경) */
export const Long: Story = {
  args: { children: '가격이 8,500원에서 9,000원으로 바뀌었어요. 다시 확인해 주세요.' },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
};
