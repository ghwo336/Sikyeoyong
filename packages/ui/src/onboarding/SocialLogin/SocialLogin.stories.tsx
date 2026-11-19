import type { Meta, StoryObj } from '@storybook/react-vite';
import { SocialLogin } from './SocialLogin';

// Harness states from docs/wiki/components/ui/onboarding/SocialLogin.md (Start.dc.html).
const meta = {
  title: 'onboarding/SocialLogin',
  component: SocialLogin,
  args: {
    onKakao: () => undefined,
    onGoogle: () => undefined,
    termsHref: '/terms',
    privacyHref: '/privacy',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SocialLogin>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 */
export const Default: Story = {};

/** 카카오 진행 중 */
export const KakaoLoading: Story = { args: { loading: 'kakao' } };
