import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmailStart } from './EmailStart';

// Harness states from docs/wiki/components/ui/onboarding/EmailStart.md (D-29).
const meta = {
  title: 'onboarding/EmailStart',
  component: EmailStart,
  args: { onStart: () => undefined, termsHref: '/terms', privacyHref: '/privacy' },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailStart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 */
export const Default: Story = {};

/** 진행 중 */
export const Loading: Story = { args: { loading: true } };
