import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustodyNote } from './CustodyNote';

const css = readFileSync(resolve(__dirname, 'CustodyNote.module.css'), 'utf8');

// Exact words written by hand from decisions D-24 "밝히는 문구".
const PLAIN = '체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요.';
const DETAILED =
  '테스트넷 데모. 에이전트 키와 소유자 권한은 운영자 서버가 보관한다(수탁, D-24). 파우치 임베디드 SDK가 나오면 사용자 지갑이 소유자가 된다.';

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

  it('is one small line: a single paragraph, caption size, secondary ink', () => {
    const { container } = render(<CustodyNote />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.children).toHaveLength(1);
    expect(css).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(css).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
