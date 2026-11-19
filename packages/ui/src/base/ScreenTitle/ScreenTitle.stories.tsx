import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScreenTitle } from './ScreenTitle';

// Harness states from docs/wiki/components/ui/base/ScreenTitle.md.
const meta = {
  title: 'base/ScreenTitle',
  component: ScreenTitle,
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof ScreenTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 큰 제목 가운데 (Start 시안) */
export const Display: Story = {
  args: {
    variant: 'display',
    title: '배달은\n용이한테 시켜용',
    description: '주인님이 정한 한도 안에서만 결제하는\n배달 비서예요. 카드 번호는 몰라요.',
  },
};

/** 제목과 설명 (Verify 시안) */
export const Title: Story = {
  args: {
    variant: 'title',
    title: '주인님이 누군지\n한 번만 확인할게요',
    description: '실명 확인된 주인만 비서를 둘 수 있어요.',
  },
};

/** 제목만 (Name 시안) */
export const TitleOnly: Story = {
  args: { variant: 'title', title: '알을 하나 골라\n이름을 지어 주세요' },
};

/** 용이 말 가운데 (Hatch 시안) */
export const Dragon: Story = {
  args: {
    variant: 'dragon',
    title: '알이 흔들려용...',
    description: '1~3분 걸려요. 다 되면 알려 드릴게요.',
  },
};

/** 좁은 폭에서 긴 제목 (360 화면) */
export const Narrow: Story = {
  args: Display.args,
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
};
