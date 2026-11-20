import { describe, expect, it } from 'vitest';
import type { OrderStatus, OrderView } from '../../lib/api';
import { activeCard, activeOrder, historyLabel, menuLabel, orderHref } from './active';

const W9000 = '9000000000000000000000';

function view(id: string, status: OrderStatus, more: Partial<OrderView> = {}): OrderView {
  return {
    id,
    status,
    store: '마루국밥 본점',
    destination: '회사(역삼동)',
    items: [{ name: '돼지국밥', quantity: 1, price: W9000 }],
    amount: W9000,
    etaAt: 1,
    remainingMin: 8,
    dragonLine: '만드는 중이에용.',
    dragonMood: 'cooking',
    ...more,
  };
}

describe('menuLabel', () => {
  it('names the first line, and how many more', () => {
    expect(menuLabel(view('a', 'paid').items)).toBe('돼지국밥');
    const two = [...view('a', 'paid').items, { name: '김밥', quantity: 2, price: W9000 }];
    expect(menuLabel(two)).toBe('돼지국밥 외 1개');
  });
});

describe('activeOrder (Main.dc.html card)', () => {
  it('is the newest order still on its way; arrived, unpaid and stopped ones have no card', () => {
    const list = [
      view('new-arrived', 'delivered'),
      view('waiting', 'pending_approval'),
      view('failed', 'failed'),
      view('cooking', 'preparing'),
      view('older', 'delivering'),
    ];
    expect(activeOrder(list)?.id).toBe('cooking');
    expect(activeOrder([view('a', 'delivered'), view('b', 'refunded')])).toBeUndefined();
    expect(activeOrder([])).toBeUndefined();
  });
});

describe('activeCard: the words of Main.dc.html per step', () => {
  it.each([
    ['submitting', '주문 접수', '가게가 확인 중', 1],
    ['paid', '주문 접수', '가게가 확인 중', 1],
    ['preparing', '조리 중', '곧 출발해요', 2],
    ['delivering', '배달 중', '8분 남았어요', 3],
  ] as const)('%s: %s, %s', (status, word, eta, current) => {
    expect(activeCard(view('a', status))).toEqual({ menu: '돼지국밥', status: word, eta, current });
  });

  it('on the road with no minutes left says it is nearly there', () => {
    expect(activeCard(view('a', 'delivering', { remainingMin: 0 })).eta).toBe('곧 도착해요');
  });
});

describe('orderHref and historyLabel (주문 내역)', () => {
  it('on its way opens the status screen, waiting opens the limit screen, the rest the receipt', () => {
    expect(orderHref(view('o 1', 'preparing'))).toBe('/orders/o%201');
    expect(orderHref(view('o1', 'pending_approval'))).toBe('/limit/o1');
    for (const s of ['delivered', 'failed', 'cancelled', 'refunded'] as const) {
      expect(orderHref(view('o1', s))).toBe('/orders/o1/receipt');
    }
  });

  it('says where it is while on its way or why it stopped, and only the menu once arrived', () => {
    expect(historyLabel(view('a', 'delivering'))).toBe('돼지국밥, 배달 중');
    expect(historyLabel(view('a', 'pending_approval'))).toBe('돼지국밥, 허락 기다리는 중');
    expect(historyLabel(view('a', 'failed'))).toBe('돼지국밥, 취소');
    expect(historyLabel(view('a', 'refunded'))).toBe('돼지국밥, 환불');
    expect(historyLabel(view('a', 'delivered'))).toBe('돼지국밥');
  });
});
