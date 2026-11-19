import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeliveryMap } from './DeliveryMap';
import { splitRoute, toPath, withRo } from './geometry';

const css = readFileSync(resolve(__dirname, 'DeliveryMap.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

// An L: 100 right, then 100 down. Total 200.
const L = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];
const base = {
  store: { x: 0, y: 0 },
  home: { x: 100, y: 100 },
  route: L,
  storeName: '마루국밥',
  homeName: '회사',
};

describe('DeliveryMap (DeliveryMap.md 테스트 기준)', () => {
  it('draws the way behind solid and the whole way dotted', () => {
    const { container } = render(
      <DeliveryMap {...base} progress={0.75} rider={{ x: 100, y: 50 }} />,
    );
    const behind = container.querySelector('[data-part="behind"]');
    const ahead = container.querySelector('[data-part="ahead"]');
    expect(behind?.getAttribute('d')).toBe('M0 0 L100 0 L100 50');
    expect(ahead?.getAttribute('d')).toBe('M0 0 L100 0 L100 100');
    expect(rule('.ahead')).toMatch(/stroke-dasharray:\s*2 8/);
    expect(rule('.behind')).not.toMatch(/dasharray/);
    // Solid is drawn on top of the dots.
    expect(ahead?.compareDocumentPosition(behind as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('is one image with a description, rider or not', () => {
    const { rerender } = render(<DeliveryMap {...base} progress={0.5} rider={{ x: 100, y: 0 }} />);
    expect(
      screen.getByRole('img', { name: '라이더가 마루국밥에서 회사로 오는 경로 지도' }),
    ).toBeInTheDocument();
    rerender(<DeliveryMap {...base} progress={0.5} />);
    expect(
      screen.getByRole('img', { name: '마루국밥에서 회사까지 경로 지도' }),
    ).toBeInTheDocument();
    rerender(<DeliveryMap {...base} homeName="집" progress={0.5} rider={{ x: 100, y: 0 }} />);
    expect(
      screen.getByRole('img', { name: '라이더가 마루국밥에서 집으로 오는 경로 지도' }),
    ).toBeInTheDocument();
  });

  it('draws the rider only when there is a position (stage 1 mock has none)', () => {
    const { container, rerender } = render(<DeliveryMap {...base} progress={0.5} />);
    expect(container.querySelector('[data-part="rider"]')).toBeNull();
    rerender(<DeliveryMap {...base} progress={0.5} rider={{ x: 100, y: 0 }} />);
    expect(container.querySelector('[data-part="rider"]')?.getAttribute('transform')).toBe(
      'translate(100 0)',
    );
  });

  it('has no solid line at the very start', () => {
    const { container } = render(<DeliveryMap {...base} progress={0} />);
    expect(container.querySelector('[data-part="behind"]')).toBeNull();
  });

  it('puts the store and home pins with their names where given', () => {
    const { container } = render(<DeliveryMap {...base} progress={0} />);
    expect(container.querySelector('[data-part="store"]')).toHaveAttribute(
      'transform',
      'translate(0 0)',
    );
    expect(container.querySelector('[data-part="home"]')).toHaveAttribute(
      'transform',
      'translate(100 100)',
    );
    expect(container.querySelector('[data-part="store"] text')?.textContent).toBe('마루국밥');
    expect(container.querySelector('[data-part="home"] text')?.textContent).toBe('회사');
  });

  it.each([
    [0, 'M0 0'],
    [0.25, 'M0 0 L50 0'],
    [0.5, 'M0 0 L100 0'],
    [1, 'M0 0 L100 0 L100 100'],
    [1.7, 'M0 0 L100 0 L100 100'],
    [-1, 'M0 0'],
    [Number.NaN, 'M0 0'],
    [Number.POSITIVE_INFINITY, 'M0 0 L100 0 L100 100'],
    [Number.NEGATIVE_INFINITY, 'M0 0'],
  ])('splits the route at progress %s', (p, d) => {
    expect(toPath(splitRoute(L, p).done)).toBe(d);
  });

  it('handles empty and one-point routes', () => {
    expect(splitRoute([], 0.5)).toEqual({ done: [], cut: undefined });
    expect(splitRoute([{ x: 3, y: 4 }], 0.5).done).toEqual([{ x: 3, y: 4 }]);
  });

  it.each([
    ['회사', '회사로'],
    ['집', '집으로'],
    ['학교', '학교로'],
    ['서울', '서울로'],
    ['A동', 'A동으로'],
    ['B', 'B로'],
  ])('says %s as %s', (word, out) => {
    expect(withRo(word)).toBe(out);
  });

  // Tracking.dc.html 23-54.
  it('matches the design colors', () => {
    expect(rule('.ground')).toMatch(/fill:\s*var\(--color-map-ground\)/);
    expect(rule('.block')).toMatch(/fill:\s*var\(--color-map-block\)/);
    expect(rule('.park')).toMatch(/fill:\s*var\(--color-map-park\)/);
    expect(rule('.riderDot')).toMatch(/fill:\s*var\(--color-leaf\)/);
    expect(rule('.bowl')).toMatch(/fill:\s*var\(--color-yolk\)/);
    expect(rule('.pin')).toMatch(/fill:\s*var\(--color-ink\)/);
  });
});
