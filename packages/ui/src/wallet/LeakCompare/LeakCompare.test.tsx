import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { LeakCompare, periodLabel } from './LeakCompare';

const css = readFileSync(resolve(__dirname, 'LeakCompare.module.css'), 'utf8');
const W = okrwToAokrw;
const base = {
  perOrderLimit: W(10_000n),
  periodicCap: W(60_000n),
  periodSec: 3_600,
  floatAtRisk: W(20_100n),
  pocket: W(20_000n),
};

describe('LeakCompare (LeakCompare.md 테스트 기준)', () => {
  it('says the screen words by rule 11, in order, with the real numbers', () => {
    const { container } = render(<LeakCompare {...base} />);
    expect(container.textContent).toBe(
      '주문으로는 큰돈이 막히고, 다른 길로 새도 주머니만 잃어용.' +
        '카드번호를 맡겼다면전부 가져가요앱 안의 한도는 열쇠가 있으면 건너뛰어요' +
        '시켜용 용이주문으로는 한 번에10,000원까지만1시간 동안 합쳐서 60,000원까지' +
        '다른 길로 보내도 용이 주머니에는20,100원만지금 주머니에 20,000원',
    );
  });

  it('keeps chain words and overclaims off the plain screen (D-17, rule 11)', () => {
    const { container } = render(<LeakCompare {...base} />);
    expect(container.textContent).not.toMatch(
      /지갑|토큰|트랜잭션|KYC|PCL|체인|float|revert|멤풀|OKRW|모두 막|전부 막/,
    );
  });

  it('shows amounts past Number range through formatOkrw (bigint, no float math)', () => {
    const big = 90_071_992_547_409_930n;
    const { container } = render(
      <LeakCompare {...base} periodicCap={W(big)} floatAtRisk={W(big + 1n)} />,
    );
    expect(container.textContent).toContain('90,071,992,547,409,930원까지');
    expect(container.textContent).toContain('90,071,992,547,409,931원만');
  });

  it('names the period for the demo profile and the 30 day one', () => {
    expect(periodLabel(3_600)).toBe('1시간');
    expect(periodLabel(2_592_000)).toBe('30일');
    expect(periodLabel(90)).toBe('90초');
  });

  it('adds the exact rule 11 line only with 자세히 보기', () => {
    const { container, rerender } = render(<LeakCompare {...base} />);
    expect(container.textContent).not.toContain('float만 잃는다');
    rerender(<LeakCompare {...base} detailed />);
    expect(container.textContent).toContain(
      '주문 경로의 큰돈은 체인이 막고, 우회 경로로는 float만 잃는다.',
    );
    expect(container.textContent).toContain('실행 중에 revert되어 블록에 남고 가스가 든다');
    expect(container.textContent).not.toContain('멤풀');
  });

  it('draws the dragon line in the dragon font and the numbers big and tabular', () => {
    expect(css).toMatch(/font-family:\s*var\(--font-dragon\)/);
    expect(css).toMatch(/font-size:\s*var\(--type-wallet-amount-size\)/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
