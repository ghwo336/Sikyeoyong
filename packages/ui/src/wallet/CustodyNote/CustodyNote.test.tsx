import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustodyNote } from './CustodyNote';

const css = readFileSync(resolve(__dirname, 'CustodyNote.module.css'), 'utf8');

// Exact words written by hand from decisions D-24 "밝히는 문구".
const PLAIN = '체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요.';
const DETAILED =
  '테스트용 체험판이에요. 용이의 열쇠와 주인 권한을 지금은 시켜용 서버가 대신 보관하고 있어요. 나중에는 주인님의 지갑이 이 권한을 직접 갖게 돼요.';

describe('CustodyNote (CustodyNote.md 테스트 기준)', () => {
  it('says the plain line, with no chain words (D-17)', () => {
    const { container } = render(<CustodyNote />);
    expect(container.textContent).toBe(PLAIN);
    expect(container.textContent).not.toMatch(/지갑|토큰|트랜잭션|KYC|PCL|테스트넷|수탁/);
  });

  it('says the exact demo line when 자세히 보기 is on', () => {
    const { container } = render(<CustodyNote detailed />);
    expect(container.textContent).toBe(DETAILED);
  });

  it('never shows a decision id, an internal product name or developer words, even detailed', () => {
    const { container } = render(<CustodyNote detailed />);
    expect(container.textContent).not.toMatch(
      /D-\d|SDK|수탁|파우치|임베디드|에이전트|테스트넷|운영자|PCL|KYC|토큰|트랜잭션/,
    );
  });

  it('is one small line: a single paragraph, caption size, secondary ink', () => {
    const { container } = render(<CustodyNote />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.children).toHaveLength(1);
    expect(css).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(css).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(css).toMatch(/text-align:\s*left/); // Wallet.dc.html rows are left aligned
  });
});
