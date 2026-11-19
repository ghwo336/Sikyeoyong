import type { Meta, StoryObj } from '@storybook/react-vite';
import { DragonLine } from './DragonLine';

// Harness states from docs/wiki/components/ui/dragon/DragonLine.md.
const meta: Meta<typeof DragonLine> = {
  title: 'dragon/DragonLine',
  component: DragonLine,
  args: { text: '국밥 끓이는 중이에용.', layout: 'inline', species: 'forest', mood: 'cooking' },
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
};

export default meta;
type Story = StoryObj<typeof DragonLine>;

/** 한 줄 */
export const OneLine: Story = {};

/** 두 줄 (Done) */
export const TwoLines: Story = { args: { text: '국밥 끓이는 중이에용.\n출발하면 알려 줄게용.' } };

/** 가운데 정렬 (Cap, Blocked) */
export const Center: Story = {
  args: {
    layout: 'center',
    mood: 'worried',
    text: '앗, 보쌈 대(大)는\n제 한도보다 비싸용.',
  },
};

/** 아바타 없음 */
export const NoAvatar: Story = { args: { avatar: false, text: '천천히 먹어용' } };
