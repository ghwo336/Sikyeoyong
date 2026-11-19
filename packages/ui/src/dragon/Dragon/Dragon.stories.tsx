import type { Meta, StoryObj } from '@storybook/react-vite';
import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { Dragon, type DragonMood, type DragonSize } from './Dragon';

// Harness states from docs/wiki/components/ui/dragon/Dragon.md.
const meta: Meta<typeof Dragon> = {
  title: 'dragon/Dragon',
  component: Dragon,
  args: { mood: 'default', size: 128, species: 'forest' },
};

export default meta;
type Story = StoryObj<typeof Dragon>;

const MOODS: DragonMood[] = [
  'default',
  'happy',
  'excited',
  'worried',
  'hiding',
  'sleeping',
  'eating',
  'cooking',
];
const SIZES: DragonSize[] = [32, 44, 56, 96, 128];
const row = { display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' } as const;

/** 표정 8종 전부 */
export const Moods: Story = {
  render: (args) => (
    <div style={row}>
      {MOODS.map((mood) => (
        <figure key={mood} style={{ margin: 0, textAlign: 'center' }}>
          <Dragon {...args} mood={mood} size={96} />
          <figcaption>{mood}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/** 종 4가지 (숲용, 물용, 꽃용, 별용) x 대표 표정 */
export const Species: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      {DRAGON_SPECIES.map((species) => (
        <div key={species} style={row}>
          {(['default', 'happy', 'worried', 'sleeping'] as const).map((mood) => (
            <Dragon key={mood} species={species} mood={mood} size={96} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** 크기 5종 */
export const Sizes: Story = {
  render: (args) => (
    <div style={row}>
      {SIZES.map((size) => (
        <Dragon key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

/** 날개 있음 (레벨 3) */
export const Wings: Story = {
  render: () => (
    <div style={row}>
      {DRAGON_SPECIES.map((species) => (
        <Dragon key={species} species={species} mood="happy" size={128} wings />
      ))}
    </div>
  ),
};
