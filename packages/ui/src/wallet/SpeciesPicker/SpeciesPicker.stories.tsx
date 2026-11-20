import type { DragonSpecies } from '@sikyeoyong/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SpeciesPicker } from './SpeciesPicker';

// Harness states from docs/wiki/components/ui/wallet/SpeciesPicker.md. Values from Look.dc.html.
const meta = {
  title: 'wallet/SpeciesPicker',
  component: SpeciesPicker,
  args: { value: 'forest', onChange: () => undefined },
  decorators: [
    (Story, ctx) => (
      <div style={{ width: 350 }} data-species={ctx.args.value}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpeciesPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 숲용 고름 (기본) */
export const Forest: Story = {};
/** 별용 고름: 테두리도 별용 색 */
export const Star: Story = { args: { value: 'star' } };

function Interactive() {
  const [value, setValue] = useState<DragonSpecies>('water');
  return (
    <div data-species={value}>
      <SpeciesPicker value={value} onChange={setValue} />
    </div>
  );
}

/** 눌러서 바꾸기 (화살표 키로도) */
export const Picking: Story = { render: () => <Interactive /> };
