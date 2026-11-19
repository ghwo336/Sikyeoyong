import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TextField } from './TextField';

const meta = {
  title: 'Base/TextField',
  component: TextField,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;
export default meta;

type Story = StoryObj<typeof meta>;

function Controlled({ initial, error }: { initial: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <TextField
      label="이름"
      value={value}
      onChange={setValue}
      placeholder="이름을 지어 주세요"
      maxLength={8}
      error={error}
    />
  );
}

const noop = () => undefined;

/** Name.dc.html before typing. */
export const Empty: Story = {
  args: { label: '이름', value: '', onChange: noop },
  render: () => <Controlled initial="" />,
};

/** Name.dc.html as drawn: "용이". */
export const Filled: Story = {
  args: { label: '이름', value: '용이', onChange: noop },
  render: () => <Controlled initial="용이" />,
};

/** user-flow.md step 3: an empty name shows a note instead of disabling the button. */
export const Invalid: Story = {
  args: { label: '이름', value: '', onChange: noop },
  render: () => <Controlled initial="" error="이름을 지어 주세요" />,
};
