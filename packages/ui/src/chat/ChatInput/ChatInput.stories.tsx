import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChatInput } from './ChatInput';

// Harness states from docs/wiki/components/ui/chat/ChatInput.md.
const meta = {
  title: 'chat/ChatInput',
  component: ChatInput,
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  value: '',
  onChange: () => undefined,
  onSend: () => undefined,
  placeholder: '오늘 저녁도 부탁해',
} as const;

function Live(props: { initial: string; sending?: boolean; disabled?: boolean; note?: string }) {
  const [value, setValue] = useState(props.initial);
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSend={() => {
        setValue('');
      }}
      placeholder={props.disabled ? '' : '오늘 저녁도 부탁해'}
      sending={props.sending}
      disabled={props.disabled}
      disabledNote={props.note}
    />
  );
}

/** 빈 칸 (Main.dc.html) */
export const Empty: Story = { args: base, render: () => <Live initial="" /> };

/** 입력됨 */
export const Filled: Story = {
  args: base,
  render: () => <Live initial="점심 시켜 줘. 따뜻한 걸로" />,
};

/** 보내는 중 */
export const Sending: Story = {
  args: base,
  render: () => <Live initial="하나 더 시켜 줘" sending />,
};

/** 멈춤 상태라 비활성 안내 */
export const Stopped: Story = {
  args: base,
  render: () => <Live initial="" disabled note="용이가 멈춰 있어요. 깨우면 다시 말할 수 있어요." />,
};
