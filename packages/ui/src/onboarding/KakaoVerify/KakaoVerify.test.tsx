import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import buttonStyles from '../../base/Button/Button.module.css';
import { KakaoVerify } from './KakaoVerify';

const errCss = readFileSync(
  resolve(__dirname, '../../base/ErrorLine/ErrorLine.module.css'),
  'utf8',
);
const errRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    errCss,
  )?.[2] ?? '';
const css = readFileSync(resolve(__dirname, 'KakaoVerify.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('KakaoVerify (KakaoVerify.md 테스트 기준)', () => {
  it('draws the Kakao check like Verify.dc.html', () => {
    const { container } = render(<KakaoVerify onVerify={vi.fn()} mode="kakao" status="idle" />);
    const button = screen.getByRole('button', { name: '카카오톡으로 본인 인증' });
    expect(button).toHaveClass(buttonStyles.kakao ?? 'kakao');
    expect(container.querySelector('.kakaoMark')).not.toBeNull();
    expect(screen.getByText('이메일로 가입했어도 카카오톡으로 인증해요')).toBeInTheDocument();
  });

  it('in mock mode changes the words, and drops the Kakao look (brand guide)', () => {
    const { container } = render(<KakaoVerify onVerify={vi.fn()} mode="mock" status="idle" />);
    const button = screen.getByRole('button', { name: '체험용으로 인증하기' });
    expect(button).toHaveClass(buttonStyles.primary ?? 'primary');
    expect(button).not.toHaveClass(buttonStyles.kakao ?? 'kakao');
    expect(container.querySelector('.kakaoMark')).toBeNull();
    expect(screen.queryByText(/카카오/)).toBeNull();
    expect(screen.getByText('체험판이라 실제 본인 인증 없이 넘어가요')).toBeInTheDocument();
  });

  it('starts the check once, and not again while pending', async () => {
    const onVerify = vi.fn();
    const { rerender } = render(<KakaoVerify onVerify={onVerify} mode="kakao" status="idle" />);
    await userEvent.click(screen.getByRole('button'));
    expect(onVerify).toHaveBeenCalledTimes(1);
    rerender(<KakaoVerify onVerify={onVerify} mode="kakao" status="pending" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(screen.getByRole('button'));
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it('says it failed and lets the user try again', async () => {
    const onVerify = vi.fn();
    render(<KakaoVerify onVerify={onVerify} mode="kakao" status="failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('인증이 안 됐어요. 다시 해 주세요.');
    expect(screen.getByRole('alert')).toHaveAttribute('data-align', 'center');
    await userEvent.click(screen.getByRole('button'));
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it('shows no failure note unless failed', () => {
    render(<KakaoVerify onVerify={vi.fn()} mode="kakao" status="idle" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Verify.dc.html 35-36.
  it('matches the design values', () => {
    expect(rule('.verify')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.note')).toMatch(/font-size:\s*var\(--type-fine-size\)/);
    expect(rule('.note')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.note')).toMatch(/text-align:\s*center/);
    expect(errRule('.line')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(errRule(".line[data-align='center']")).toMatch(/text-align:\s*center/);
  });
});
