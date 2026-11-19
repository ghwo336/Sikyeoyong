import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { useState } from 'react';
import { Meter } from '../../base/Meter';
import { DragonLine } from '../../dragon/DragonLine';
import { ChatHeader } from '../ChatHeader';
import { ChatInput } from '../ChatInput';
import { ChatThread } from '../ChatThread';
import { UserBubble } from '../UserBubble';
import { ChatLayout } from './ChatLayout';

// Harness states from docs/wiki/components/ui/chat/ChatLayout.md. Lines from Main.dc.html.
const meta = {
  title: 'chat/ChatLayout',
  component: ChatLayout,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ width: 390, height: 844, display: 'flex', flexDirection: 'column' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function Input() {
  const [value, setValue] = useState('');
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSend={() => {
        setValue('');
      }}
      placeholder="오늘 저녁도 부탁해"
    />
  );
}

const thread = (
  <ChatThread stamp="오늘 오후 12:28">
    <UserBubble text="점심 시켜 줘. 따뜻한 걸로" />
    <DragonLine
      text="비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용."
      layout="chat"
      species="forest"
    />
  </ChatThread>
);

/** 위 줄, 예산 카드, 대화, 입력칸 (Main 시안) */
export const Main: Story = {
  args: { children: null, footer: null },
  render: () => (
    <ChatLayout
      header={
        <ChatHeader
          name="용이"
          caption="레벨 1, 한 번에 10,000원까지"
          species="forest"
          onSettings={() => undefined}
        />
      }
      top={
        <Meter
          label="이번 달 배달비"
          value={okrwToAokrw(210_000n)}
          max={okrwToAokrw(300_000n)}
          tone="warn"
          framed
        />
      }
      footer={<Input />}
    >
      {thread}
    </ChatLayout>
  ),
};

/** 예산 카드 없음 (LimitChat 시안) */
export const NoTop: Story = {
  args: { children: null, footer: null },
  render: () => (
    <ChatLayout
      header={<ChatHeader name="용이" caption="레벨 1, 한 번에 10,000원까지" species="forest" />}
      footer={<Input />}
    >
      {thread}
    </ChatLayout>
  ),
};
