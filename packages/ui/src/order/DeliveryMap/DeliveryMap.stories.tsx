import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeliveryMap } from './DeliveryMap';
import { splitRoute } from './geometry';

// Harness states from docs/wiki/components/ui/order/DeliveryMap.md. Route from Tracking.dc.html.
const ROUTE = [
  { x: 330, y: 110 },
  { x: 275, y: 110 },
  { x: 275, y: 180 },
  { x: 155, y: 180 },
  { x: 155, y: 285 },
  { x: 120, y: 285 },
];
const at = (p: number) => splitRoute(ROUTE, p).cut;

const meta = {
  title: 'order/DeliveryMap',
  component: DeliveryMap,
  parameters: { layout: 'fullscreen' },
  args: {
    store: { x: 330, y: 110 },
    home: { x: 120, y: 285 },
    route: ROUTE,
    storeName: '마루국밥',
    homeName: '회사',
    progress: 0,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 390, height: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeliveryMap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 출발 직후 */
export const JustLeft: Story = { args: { progress: 0.05, rider: at(0.05) } };

/** 절반 (Tracking.dc.html 쯤) */
export const Halfway: Story = { args: { progress: 0.5, rider: at(0.5) } };

/** 거의 도착 */
export const AlmostThere: Story = { args: { progress: 0.92, rider: at(0.92) } };

/** 라이더 위치 없음 (1단계 목 가게) */
export const NoRider: Story = { args: { progress: 0.5 } };
