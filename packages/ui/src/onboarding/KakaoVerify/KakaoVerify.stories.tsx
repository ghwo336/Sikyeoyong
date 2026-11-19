import type { Meta, StoryObj } from '@storybook/react-vite';
import { KakaoVerify } from './KakaoVerify';

// Harness states from docs/wiki/components/ui/onboarding/KakaoVerify.md (Verify.dc.html).
const meta = {
  title: 'onboarding/KakaoVerify',
  component: KakaoVerify,
  args: { onVerify: () => undefined, mode: 'kakao', status: 'idle' },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KakaoVerify>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 */
export const Default: Story = {};
/** 진행 중 */
export const Pending: Story = { args: { status: 'pending' } };
/** 실패 */
export const Failed: Story = { args: { status: 'failed' } };
/** 체험용 인증 (mock) */
export const Mock: Story = { args: { mode: 'mock' } };
