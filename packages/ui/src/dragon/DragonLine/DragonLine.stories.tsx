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
    text: '앗, 보쌈 대(大)는\n제가 한 번에 쓸 수 있는 돈보다 커용.',
  },
};

/** 대화 (Main): 작은 용이 옆에 위쪽 정렬 */
export const Chat: Story = {
  args: {
    layout: 'chat',
    mood: 'default',
    text: '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용.',
  },
};

/** 아바타 없음 */
export const NoAvatar: Story = { args: { avatar: false, text: '천천히 먹어용' } };
