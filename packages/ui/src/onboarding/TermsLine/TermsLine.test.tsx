import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TermsLine } from './TermsLine';

const css = readFileSync(resolve(__dirname, 'TermsLine.module.css'), 'utf8');

describe('TermsLine (TermsLine.md 테스트 기준)', () => {
  it('says the one line with the two links', () => {
    const { container } = render(<TermsLine termsHref="/terms" privacyHref="/privacy" />);
    expect(container.textContent).toBe('시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요');
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('uses the Start design values: 6 above, fine type, secondary ink, centered', () => {
    expect(css).toMatch(/margin:\s*var\(--size-terms-top\) 0 0/);
    expect(css).toMatch(/font-size:\s*var\(--type-fine-size\)/);
    expect(css).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(css).toMatch(/text-align:\s*center/);
  });
});
