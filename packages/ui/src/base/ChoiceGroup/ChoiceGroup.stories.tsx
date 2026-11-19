import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Chip } from '../Chip';
import { ChoiceGroup } from './ChoiceGroup';

// Harness states from docs/wiki/components/ui/base/ChoiceGroup.md. A small wrapper keeps
// the picked value so pressing and arrow keys can be tried.
const TASTES = ['또 먹을래', '괜찮았어', '별로였어'];

function Demo({
  initial,
  layout,
  title,
}: {
  initial?: string;
  layout: 'columns' | 'row';
  title?: string;
}) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <ChoiceGroup
      options={TASTES}
      value={value}
      onChange={setValue}
      keyOf={(o) => o}
      layout={layout}
      title={title}
      label={title === undefined ? '맛' : undefined}
      renderOption={(o, s) => (
        <Chip size="tile" selected={s.selected} tabIndex={s.tabIndex} onPress={s.select}>
          {o}
        </Chip>
      )}
    />
  );
}

const meta = {
  title: 'base/ChoiceGroup',
  component: Demo,
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 아직 안 고름 (제목, 같은 너비 칸) */
export const Unpicked: Story = { args: { layout: 'columns', title: '오늘 돼지국밥 어땠어요?' } };

/** 하나 고름 */
export const Picked: Story = {
  args: { layout: 'columns', title: '오늘 돼지국밥 어땠어요?', initial: '괜찮았어' },
};

/** 제목 없이 한 줄 (이름은 화면 읽기만) */
export const RowNoTitle: Story = { args: { layout: 'row', initial: '또 먹을래' } };
