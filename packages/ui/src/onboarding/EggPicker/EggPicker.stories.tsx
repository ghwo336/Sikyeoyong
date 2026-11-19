import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DragonSpecies } from '@sikyeoyong/shared';
import { useState } from 'react';
import { EggPicker } from './EggPicker';

// Harness states from docs/wiki/components/ui/onboarding/EggPicker.md (Name.dc.html, D-20).
const meta = {
  title: 'onboarding/EggPicker',
  component: EggPicker,
  args: { value: 'forest', onChange: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EggPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial }: { initial: DragonSpecies }) {
  const [value, setValue] = useState<DragonSpecies>(initial);
  return <EggPicker value={value} onChange={setValue} />;
}

/** 숲용 선택됨 */
export const Forest: Story = { render: () => <Live initial="forest" /> };
/** 물용 선택됨 */
export const Water: Story = { render: () => <Live initial="water" /> };
/** 꽃용 선택됨 */
export const Flower: Story = { render: () => <Live initial="flower" /> };
/** 별용 선택됨 */
export const Star: Story = { render: () => <Live initial="star" /> };
