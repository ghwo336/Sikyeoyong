import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

// Harness states from docs/wiki/components/ui/base/Button.md.
const meta = {
  title: 'base/Button',
  component: Button,
  args: { variant: 'primary', size: 'lg', children: '시켜용', onPress: () => undefined },
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 여섯 종류 */
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Button {...args} variant="primary">
        시켜용
      </Button>
      <Button {...args} variant="secondary">
        구글로 시작하기
      </Button>
      <Button {...args} variant="outline">
        돌려받기
      </Button>
      <Button {...args} variant="text">
        다시 고를래
      </Button>
      <Button {...args} variant="link">
        다시 보내기
      </Button>
      <Button {...args} variant="kakao">
        카카오로 시작하기
      </Button>
    </div>
  ),
};

/** 누름 (0.97 스프링). 하네스에서 눌러 본다 */
export const Press: Story = { args: { children: '눌러 보세요' } };

/** 로딩 */
export const Loading: Story = { args: { loading: true, children: '시켜용' } };

/** 아이콘 포함 */
export const WithIcon: Story = {
  args: {
    variant: 'kakao',
    children: '카카오로 시작하기',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="currentColor" />
      </svg>
    ),
  },
};

/** 긴 문구 줄바꿈 */
export const LongLabel: Story = {
  args: { children: '이번 달 예산을 넘는데 그래도 이 가게에서 시킬래요' },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
};

/** 작은 크기 (md): 시안 Wallet처럼 금액 옆에 붙는다 */
export const Medium: Story = {
  args: { size: 'md', variant: 'primary', children: '채우기' },
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>20,000원</span>
      <Button {...args} />
    </div>
  ),
};

/** 작은 글자 버튼 (sm, link): 실패 줄 옆 "다시 보내기", "다시 깨우기" */
export const Small: Story = {
  args: { size: 'sm', variant: 'link', children: '다시 보내기' },
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>못 보냈어요</span>
      <Button {...args} />
    </div>
  ),
};

/** 고르기 크기 (choice, 52): Blocked "다시 고르기", LimitChat "바꾸기"와 "그만두기" */
export const Choice: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Button {...args} variant="primary" size="choice">
        바꾸기
      </Button>
      <Button {...args} variant="secondary" size="choice">
        10,000원 안에서 다시 고르기
      </Button>
      <Button {...args} variant="text" size="md">
        그만두기
      </Button>
    </div>
  ),
};

/** 두 줄 크기 (tall, 64): Blocked "레벨 올리고 시키기". 줄은 부르는 쪽이 쌓는다 */
export const Tall: Story = {
  args: {
    size: 'tall',
    variant: 'primary',
    children: (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span>레벨 3으로 올리고 시키기</span>
        <span style={{ fontSize: 13 }}>한 번에 50,000원까지</span>
      </span>
    ),
  },
};

/** 테두리 알약 (outline md): Frozen "돌려받기" */
export const Outline: Story = {
  args: { size: 'md', variant: 'outline', children: '돌려받기' },
};
