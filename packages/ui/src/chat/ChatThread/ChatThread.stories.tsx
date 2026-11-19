import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState } from 'react';
import { DragonLine } from '../../dragon/DragonLine';
import { UserBubble } from '../UserBubble';
import { ChatThread } from './ChatThread';

// Harness states from docs/wiki/components/ui/chat/ChatThread.md. Lines from Main.dc.html.
const meta = {
  title: 'chat/ChatThread',
  component: ChatThread,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ width: 390, height: 640, display: 'flex', flexDirection: 'column' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatThread>;

export default meta;
type Story = StoryObj<typeof meta>;

const ANSWER = '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용.';

/** 짧은 대화 */
export const Short: Story = {
  args: { stamp: '오늘 오후 12:28', children: null },
  render: (args) => (
    <ChatThread stamp={args.stamp}>
      <UserBubble text="점심 시켜 줘. 따뜻한 걸로" />
      <DragonLine text={ANSWER} layout="chat" species="forest" />
    </ChatThread>
  ),
};

/** 긴 대화 스크롤: 맨 아래에서 시작하고, 위로 올리면 따라가지 않는다 */
export const Long: Story = {
  args: { children: null },
  render: () => (
    <ChatThread stamp="오늘 오후 12:28">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <UserBubble text={`${String(i + 1)}번째 부탁이에요`} />
          <DragonLine text={ANSWER} layout="chat" species="forest" />
        </div>
      ))}
    </ChatThread>
  ),
};

function Streaming() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= ANSWER.length) return undefined;
    const t = setTimeout(() => {
      setShown((n) => n + 1);
    }, 60);
    return () => {
      clearTimeout(t);
    };
  }, [shown]);
  return (
    <ChatThread stamp="오늘 오후 12:28" streaming={shown < ANSWER.length}>
      {Array.from({ length: 6 }, (_, i) => (
        <UserBubble key={i} text={`${String(i + 1)}번째 부탁이에요`} />
      ))}
      <DragonLine text={ANSWER.slice(0, Math.max(1, shown))} layout="chat" species="forest" />
    </ChatThread>
  );
}

/** 스트리밍 중: 답이 한 글자씩 늘어나도 따라 내려간다 */
export const StreamingAnswer: Story = {
  args: { children: null },
  render: () => <Streaming />,
};
