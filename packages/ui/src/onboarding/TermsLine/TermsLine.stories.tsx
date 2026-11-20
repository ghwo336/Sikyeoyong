import type { Meta, StoryObj } from '@storybook/react-vite';
import { TermsLine } from './TermsLine';

// Harness states from docs/wiki/components/ui/onboarding/TermsLine.md (Start.dc.html).
const meta = {
  title: 'onboarding/TermsLine',
  component: TermsLine,
  args: { termsHref: '/terms', privacyHref: '/privacy' },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TermsLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 */
export const Default: Story = {};
