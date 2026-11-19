import type { Meta, StoryObj } from '@storybook/react-vite';
import { Egg } from '../../dragon/Egg';
import { ScreenTitle } from '../ScreenTitle';
import { Hero } from './Hero';

// Harness states from docs/wiki/components/ui/base/Hero.md.
const meta = {
  title: 'base/Hero',
  component: Hero,
  decorators: [
    (Story) => (
      <div style={{ width: 342, height: 560, display: 'flex', flexDirection: 'column' }}>
        {Story()}
      </div>
    ),
  ],
} satisfies Meta<typeof Hero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 알과 큰 제목, 간격 28 (Start 시안) */
export const Start: Story = {
  args: {
    gap: 'lg',
    art: <Egg state="closed" species="forest" size={168} />,
    children: (
      <ScreenTitle
        variant="display"
        title={'배달은\n용이한테 시켜용'}
        description={'주인님이 정한 한도 안에서만 결제하는\n배달 비서예요. 카드 번호는 몰라요.'}
      />
    ),
  },
};

/** 흔들리는 알과 용이 말, 간격 24 (Hatch 시안) */
export const Hatch: Story = {
  args: {
    gap: 'md',
    art: <Egg state="wobble" species="forest" size={176} />,
    children: (
      <ScreenTitle
        variant="dragon"
        title="알이 흔들려용..."
        description="1~3분 걸려요. 다 되면 알려 드릴게요."
      />
    ),
  },
};
