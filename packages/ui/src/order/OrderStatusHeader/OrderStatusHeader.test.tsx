import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatKstClock, formatRemaining, OrderStatusHeader } from './OrderStatusHeader';

const css = readFileSync(resolve(__dirname, 'OrderStatusHeader.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

// 2026-12-09 12:55 KST = 03:55 UTC
const ETA = Date.UTC(2026, 11, 9, 3, 55);

describe('OrderStatusHeader (OrderStatusHeader.md 테스트 기준)', () => {
  it("shows KST 'N시 M분' whatever the device time zone", () => {
    // The test runner's TZ is not Seoul in CI; the result must not depend on it.
    expect(formatKstClock(ETA)).toBe('12시 55분');
    expect(formatKstClock(Date.UTC(2026, 11, 9, 15, 5))).toBe('0시 5분'); // past midnight KST
    expect(formatKstClock(Date.UTC(2026, 11, 9, 4, 5))).toBe('13시 5분');
  });

  it('puts the arrival time first on Done', () => {
    const { container } = render(
      <OrderStatusHeader etaAt={ETA} remainingMin={25} variant="eta-first" />,
    );
    const [big, small] = Array.from(container.querySelectorAll('p'));
    expect(big?.textContent).toBe('12시 55분 도착 예정');
    expect(small?.textContent).toBe('25분 남았어요');
  });

  it('puts the minutes left first on Tracking, with the distance', () => {
    const { container } = render(
      <OrderStatusHeader etaAt={ETA} remainingMin={8} variant="remaining-first" distance="1.2km" />,
    );
    const [big, small] = Array.from(container.querySelectorAll('p'));
    expect(big?.textContent).toBe('8분 남았어요');
    expect(small?.textContent).toBe('12시 55분 도착 예정, 1.2km');
  });

  it('has no distance on Done even if given, and none when empty', () => {
    const { container, rerender } = render(
      <OrderStatusHeader etaAt={ETA} remainingMin={25} variant="eta-first" distance="1.2km" />,
    );
    expect(container.textContent).not.toContain('1.2km');
    rerender(
      <OrderStatusHeader etaAt={ETA} remainingMin={8} variant="remaining-first" distance="" />,
    );
    expect(container.querySelectorAll('p')[1]?.textContent).toBe('12시 55분 도착 예정');
  });

  it.each([
    [8, '8분 남았어요'],
    [8.2, '9분 남았어요'],
    [1, '1분 남았어요'],
    [0, '곧 도착해요'],
    [-3, '곧 도착해요'],
    [Number.NaN, '곧 도착해요'],
  ])('says %s minutes as %s', (min, text) => {
    expect(formatRemaining(min)).toBe(text);
  });

  // Done.dc.html 26-29, Tracking.dc.html 58-61.
  it('uses fixed-width digits and the design sizes', () => {
    expect(rule('.header')).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(rule('.header')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(rule('.big')).toMatch(/font-size:\s*var\(--type-display-size\)/);
    expect(rule('.big')).toMatch(/font-weight:\s*var\(--type-display-weight\)/);
    expect(rule('.big')).toMatch(/letter-spacing:\s*var\(--type-display-letter-spacing\)/);
    expect(rule('.small')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.small')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
