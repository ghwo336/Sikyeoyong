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

/** Confirm.dc.html: 시트 위 44px 용이와 18px 말 */
export const Sheet: Story = {
  args: { layout: 'sheet', text: '돼지국밥 시킬게용.\n이대로 괜찮아용?' },
};

/** Budget.dc.html: 96px 용이 옆에 20px 인사 */
export const Greeting: Story = {
  args: {
    layout: 'greeting',
    mood: 'default',
    text: '안녕하세용!\n용이예용. 얼마까지 맡겨 줄래용?',
  },
};

/** Budget.dc.html (D-31): 한 번에 쓸 돈에 따라 자라는 용이 (1단계 80, 2단계 92, 3단계 104와 날개) */
export const GreetingGrows: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 16 }}>
      {([1, 2, 3] as const).map((stage) => (
        <DragonLine key={stage} {...args} stage={stage} />
      ))}
    </div>
  ),
  args: {
    layout: 'greeting',
    mood: 'default',
    text: '안녕하세용!\n용이예용. 얼마까지 맡겨 줄래용?',
  },
};

/** Main.dc.html: 말 아래 같은 칸에 추천 카드 (여기서는 같은 크기의 빈 카드) */
export const ChatWithCard: Story = {
  args: {
    layout: 'chat',
    mood: 'default',
    text: '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용.',
    children: (
      <div
        style={{
          height: 192,
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
        }}
      />
    ),
  },
};
