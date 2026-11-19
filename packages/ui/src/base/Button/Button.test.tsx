import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

const css = readFileSync(resolve(__dirname, 'Button.module.css'), 'utf8');

describe('Button (Button.md 테스트 기준)', () => {
  it('calls onPress once per press', async () => {
    const onPress = vi.fn();
    render(
      <Button variant="primary" onPress={onPress}>
        시켜용
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: '시켜용' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress while loading, even when pressed twice', async () => {
    const onPress = vi.fn();
    render(
      <Button variant="primary" loading onPress={onPress}>
        시켜용
      </Button>,
    );
    const button = screen.getByRole('button', { name: '시켜용' });
    await userEvent.dblClick(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is reachable by keyboard and has a visible focus style', async () => {
    const onPress = vi.fn();
    render(
      <Button variant="secondary" onPress={onPress}>
        구글로 시작하기
      </Button>,
    );
    await userEvent.tab();
    const button = screen.getByRole('button', { name: '구글로 시작하기' });
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(css).toMatch(/\.button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-leaf\)/);
  });

  it('keeps the touch target at least 44px for every size', () => {
    // lg uses size.buttonPrimary (56), md uses size.touchMin (44) from design/tokens.json.
    expect(css).toMatch(/\.lg\s*\{[^}]*min-height:\s*var\(--size-button-primary\)/);
    expect(css).toMatch(/\.md\s*\{[^}]*min-height:\s*var\(--size-touch-min\)/);
  });

  it('is a plain button (never submits a form) and hides the icon from screen readers', () => {
    render(
      <Button variant="kakao" icon={<svg data-testid="icon" />} onPress={() => undefined}>
        카카오로 시작하기
      </Button>,
    );
    const button = screen.getByRole('button', { name: '카카오로 시작하기' });
    expect(button).toHaveAttribute('type', 'button');
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(['primary', 'secondary', 'text', 'kakao'] as const)(
    'renders the %s variant class',
    (variant) => {
      render(
        <Button variant={variant} onPress={() => undefined}>
          x
        </Button>,
      );
      expect(screen.getByRole('button').className).toContain(variant);
    },
  );
});
