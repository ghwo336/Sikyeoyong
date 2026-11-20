import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import buttonStyles from '../../base/Button/Button.module.css';
import { EmailStart } from './EmailStart';

const base = { onStart: vi.fn(), termsHref: '/terms', privacyHref: '/privacy' };
const button = () => screen.getByRole('button', { name: '이메일로 시작하기' });

describe('EmailStart (EmailStart.md 테스트 기준)', () => {
  it('one primary button "이메일로 시작하기", then the terms line; no brand name', () => {
    const { container } = render(<EmailStart {...base} />);
    expect(button()).toHaveClass(buttonStyles.primary ?? 'primary');
    expect(container.textContent).not.toMatch(/파우치|Pouchi|카카오|구글|지갑/);
    expect(screen.getByRole('link', { name: '이용약관' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('starts once a press, and not again while one runs', async () => {
    const onStart = vi.fn();
    const { rerender } = render(<EmailStart {...base} onStart={onStart} />);
    await userEvent.click(button());
    expect(onStart).toHaveBeenCalledTimes(1);
    rerender(<EmailStart {...base} onStart={onStart} loading />);
    await userEvent.click(button());
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
