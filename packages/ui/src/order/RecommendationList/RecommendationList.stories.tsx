import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { RecommendationList } from './RecommendationList';

// Harness states from docs/wiki/components/ui/order/RecommendationList.md. Rows from Main.dc.html.
const meta = {
  title: 'order/RecommendationList',
  component: RecommendationList,
  args: { onPick: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 308 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecommendationList>;

export default meta;
type Story = StoryObj<typeof meta>;

const GUKBAP = {
  id: 'gukbap',
  store: '마루국밥 본점',
  eta: '25분',
  menu: '돼지국밥',
  price: okrwToAokrw(9_000n),
};
const EOMUK = {
  id: 'eomuk',
  store: '대청분식',
  eta: '20분',
  menu: '어묵탕과 김밥',
  price: okrwToAokrw(8_500n),
};
const BOSSAM = {
  id: 'bossam',
  store: '한상보쌈',
  eta: '35분',
  menu: '보쌈 정식',
  price: okrwToAokrw(12_000n),
};

/** 세 개 */
export const Three: Story = { args: { items: [GUKBAP, EOMUK, { ...BOSSAM }] } };

/** 허락 필요 표시 포함 (Main.dc.html) */
export const WithApproval: Story = {
  args: { items: [GUKBAP, EOMUK, { ...BOSSAM, needsApproval: true }] },
};

/** 로딩 스켈레톤 */
export const Loading: Story = { args: { items: [], loading: true } };

/** 추천 없음: 카드를 그리지 않는다 (용이 말이 대신 알린다) */
export const Empty: Story = { args: { items: [] } };
