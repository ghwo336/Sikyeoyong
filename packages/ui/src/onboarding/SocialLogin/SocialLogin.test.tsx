import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import buttonStyles from '../../base/Button/Button.module.css';
import { SocialLogin } from './SocialLogin';

const css = readFileSync(resolve(__dirname, 'SocialLogin.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
const tokens = readFileSync(resolve(__dirname, '../../tokens/tokens.css'), 'utf8');

const base = { onKakao: vi.fn(), onGoogle: vi.fn(), termsHref: '/terms', privacyHref: '/privacy' };
const kakao = () => screen.getByRole('button', { name: '카카오로 시작하기' });
const google = () => screen.getByRole('button', { name: '구글로 시작하기' });

describe('SocialLogin (SocialLogin.md 테스트 기준)', () => {
  it('draws the Kakao button with the Kakao guide color and speech-bubble mark', () => {
    const { container } = render(<SocialLogin {...base} />);
    expect(kakao()).toHaveClass(buttonStyles.kakao ?? 'kakao');
    // Kakao login guide: #FEE500 background, #191919 (85% black) mark and text.
    expect(tokens).toMatch(/--color-kakao:\s*#FEE500/);
    expect(tokens).toMatch(/--color-kakao-ink:\s*#191919/);
    expect(rule('.kakaoMark')).toMatch(/fill:\s*var\(--color-kakao-ink\)/);
    const mark = container.querySelector('.kakaoMark');
    expect(mark?.querySelector('path')?.getAttribute('d')).toMatch(/^M12 4C7 4 3 7\.1 3 11/);
    expect(kakao().compareDocumentPosition(google())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('draws Google as the white bordered button with the four-color G', () => {
    const { container } = render(<SocialLogin {...base} />);
    expect(google()).toHaveClass(buttonStyles.secondary ?? 'secondary');
    const g = container.querySelectorAll('.googleMark path');
    expect(Array.from(g).map((p) => p.getAttribute('class'))).toEqual([
      'gBlue',
      'gGreen',
      'gYellow',
      'gRed',
    ]);
    expect(tokens).toMatch(/--color-google-blue:\s*#4285F4/);
    expect(tokens).toMatch(/--color-google-green:\s*#34A853/);
    expect(tokens).toMatch(/--color-google-yellow:\s*#FBBC05/);
    expect(tokens).toMatch(/--color-google-red:\s*#EA4335/);
  });

  it('starts each sign-in once', async () => {
    const onKakao = vi.fn();
    const onGoogle = vi.fn();
    render(<SocialLogin {...base} onKakao={onKakao} onGoogle={onGoogle} />);
    await userEvent.click(kakao());
    await userEvent.click(google());
    expect(onKakao).toHaveBeenCalledTimes(1);
    expect(onGoogle).toHaveBeenCalledTimes(1);
  });

  it.each(['kakao', 'google'] as const)(
    'starts nothing else while %s sign-in is under way',
    async (loading) => {
      const onKakao = vi.fn();
      const onGoogle = vi.fn();
      render(<SocialLogin {...base} onKakao={onKakao} onGoogle={onGoogle} loading={loading} />);
      const busy = loading === 'kakao' ? kakao() : google();
      const other = loading === 'kakao' ? google() : kakao();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      expect(other).not.toHaveAttribute('aria-busy');
      await userEvent.click(kakao());
      await userEvent.click(google());
      expect(onKakao).not.toHaveBeenCalled();
      expect(onGoogle).not.toHaveBeenCalled();
    },
  );

  it('shows one terms line with both links', () => {
    render(<SocialLogin {...base} />);
    expect(screen.getByText(/시작하면/).textContent).toBe(
      '시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요',
    );
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  // Start.dc.html 29-33.
  it('matches the design values', () => {
    expect(rule('.login')).toMatch(/gap:\s*var\(--size-social-gap\)/);
    // The terms line's own values are TermsLine's (TermsLine.test.tsx).
    expect(rule('.kakaoMark')).toMatch(/width:\s*var\(--size-social-mark\)/);
    expect(rule('.googleMark')).toMatch(/width:\s*var\(--size-google-mark\)/);
  });
});
