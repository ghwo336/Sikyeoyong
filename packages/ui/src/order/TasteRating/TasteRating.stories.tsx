import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { type Taste, TasteRating } from './TasteRating';

// Harness states from docs/wiki/components/ui/order/TasteRating.md.
const meta = {
  title: 'order/TasteRating',
  component: TasteRating,
  args: { menu: '돼지국밥', onPick: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TasteRating>;

export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial }: { initial?: Taste }) {
  const [value, setValue] = useState<Taste | undefined>(initial);
  return <TasteRating menu="돼지국밥" value={value} onPick={setValue} />;
}

/** 안 고름 (Arrived.dc.html) */
export const NotPicked: Story = { render: () => <Live /> };

/** 고름 */
export const Picked: Story = { render: () => <Live initial="again" /> };
