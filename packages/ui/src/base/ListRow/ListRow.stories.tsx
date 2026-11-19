import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Switch } from '../Switch';
import { ListRow } from './ListRow';

// Harness states from docs/wiki/components/ui/base/ListRow.md. Rows from Wallet.dc.html.
const meta = {
  title: 'base/ListRow',
  component: ListRow,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const press = () => undefined;

/** 값만 */
export const ValueOnly: Story = {
  args: { label: '30일 한도', value: '219,000 / 500,000원' },
};

/** 화살표 */
export const Chevron: Story = {
  args: { label: '한 번에 쓸 수 있는 돈', value: '10,000원', trailing: 'chevron', onPress: press },
};

function StopRow() {
  const [on, setOn] = useState(false);
  return (
    <ListRow
      label="용이 멈추기"
      trailing={(labelId) => <Switch checked={on} onChange={setOn} labelId={labelId} />}
    />
  );
}

/** 스위치 */
export const WithSwitch: Story = {
  args: { label: '용이 멈추기' },
  render: () => <StopRow />,
};

/** 강조 값(잎색) */
export const Accent: Story = {
  args: { label: '이번 달 아낀 돈', value: '32,000원', tone: 'accent' },
};
