import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRESS } from '../press';
import { Button } from './Button';

// The device preference is cached by motion, so the preference hook is controlled here (Amount.test).
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('../reduced-motion', () => ({ useShouldReduceMotion: () => reduced.value }));

// whileTap never reaches the DOM, so the real motion.button is wrapped to see what it was given.
const tap = vi.hoisted((): { last: unknown } => ({ last: undefined }));
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  const { createElement } = await import('react');
  const Real = actual.motion.button;
  return {
    ...actual,
    motion: {
      button: (props: Parameters<typeof Real>[0]) => {
        tap.last = props.whileTap;
        return createElement(Real, props);
      },
    },
  };
});

afterEach(() => {
  reduced.value = false;
  tap.last = undefined;
});

const css = readFileSync(resolve(__dirname, 'Button.module.css'), 'utf8');

describe('Button (Button.md 테스트 기준)', () => {
  it('presses at 0.97 normally and not at all under reduced motion', () => {
    const { rerender } = render(
      <Button variant="primary" onPress={() => undefined}>
        시켜용
      </Button>,
    );
    expect(tap.last).toEqual(PRESS);
    reduced.value = true;
    rerender(
      <Button variant="primary" onPress={() => undefined}>
        시켜용
      </Button>,
    );
    expect(tap.last).toBeUndefined();
  });

  it('does not press while loading', () => {
    render(
      <Button variant="primary" loading onPress={() => undefined}>
        시켜용
      </Button>,
    );
    expect(tap.last).toBeUndefined();
  });

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
    expect(css).toMatch(
      /\.button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--theme-accent\)/,
    );
  });

  it('keeps the touch target at least 44px for every size', () => {
    // Rules: lg 56 (size.buttonPrimary), text lg 48 (size.buttonSecondary), md 44 (size.touchMin).
    expect(css).toMatch(/\.lg\s*\{[^}]*min-height:\s*var\(--size-button-primary\)/);
    expect(css).toMatch(/\.text\.lg\s*\{[^}]*min-height:\s*var\(--size-button-secondary\)/);
    expect(css).toMatch(/\.md\s*\{[^}]*min-height:\s*var\(--size-touch-min\)/);
    // And the size class is really on the rendered element (default lg).
    const { rerender } = render(
      <Button variant="primary" onPress={() => undefined}>
        x
      </Button>,
    );
    expect(screen.getByRole('button').classList).toContain('lg');
    rerender(
      <Button variant="primary" size="md" onPress={() => undefined}>
        x
      </Button>,
    );
    expect(screen.getByRole('button').classList).toContain('md');
    expect(screen.getByRole('button').classList).not.toContain('lg');
  });

  it('matches the design text sizes per variant (Confirm, Start, Wallet)', () => {
    expect(css).toMatch(/\.primary\.lg\s*\{[^}]*font-size:\s*var\(--type-button-size\)/);
    expect(css).toMatch(/\.lg\s*\{[^}]*font-size:\s*var\(--type-button-sub-size\)/);
    expect(css).toMatch(/\.text\.lg\s*\{[^}]*font-size:\s*var\(--type-body-size\)/);
    expect(css).toMatch(/\.primary\.lg\s*\{[^}]*font-weight:\s*var\(--type-button-weight\)/);
    expect(css).toMatch(/\.lg\s*\{[^}]*font-weight:\s*var\(--type-button-sub-weight\)/);
    expect(css).toMatch(/\.text\.lg\s*\{[^}]*font-weight:\s*var\(--type-body-weight\)/);
    // md sits next to an amount (Wallet "채우기"): content width, not full width.
    expect(css).toMatch(/\.md\s*\{[^}]*width:\s*auto/);
    expect(css).not.toMatch(/\.button\s*\{[^}]*width:\s*100%/);
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

  it('keeps the screen sizes that used to be hand-built buttons (Blocked, LimitChat, Frozen)', () => {
    // sm 44 (size.touchMin), choice 52 (size.choiceButton), tall 64 (size.raiseButton).
    expect(css).toMatch(/\.sm\s*\{[^}]*min-height:\s*var\(--size-touch-min\)/);
    expect(css).toMatch(/\.choice\s*\{[^}]*min-height:\s*var\(--size-choice-button\)/);
    expect(css).toMatch(/\.tall\s*\{[^}]*min-height:\s*var\(--size-raise-button\)/);
    // LimitChat card button: radius 16, 16/700.
    expect(css).toMatch(/\.primary\.choice\s*\{[^}]*border-radius:\s*var\(--radius-card-button\)/);
    // Wallet "채우기" and Frozen "돌려받기" are 0 18px pills.
    expect(css).toMatch(/\.md\s*\{[^}]*padding:\s*0 var\(--size-pill-pad-x\)/);
    expect(css).toMatch(/\.outline\s*\{[^}]*border:\s*1px solid var\(--color-ink\)/);
    expect(css).toMatch(/\.link\s*\{[^}]*color:\s*var\(--theme-accent\)/);
    // Budget "받기": leaf line and leaf words on white.
    expect(css).toMatch(/\.accent\s*\{[^}]*border:\s*1px solid var\(--theme-accent\)/);
    expect(css).toMatch(/\.accent\s*\{[^}]*color:\s*var\(--theme-accent\)/);
    expect(css).toMatch(/\.accent\s*\{[^}]*background:\s*var\(--color-surface\)/);
  });

  it.each(['sm', 'choice', 'tall', 'round'] as const)('renders the %s size class', (size) => {
    render(
      <Button variant="primary" size={size} onPress={() => undefined}>
        x
      </Button>,
    );
    expect(screen.getByRole('button').classList).toContain(size);
  });

  it.each(['primary', 'secondary', 'outline', 'accent', 'soft', 'text', 'link', 'kakao'] as const)(
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

  it('does nothing and does not press when disabled (Budget "−" at the lowest amount)', async () => {
    const onPress = vi.fn();
    render(
      <Button variant="soft" size="round" disabled label="내리기" onPress={onPress}>
        −
      </Button>,
    );
    const button = screen.getByRole('button', { name: '내리기' });
    // aria-disabled keeps focus on the button when a keyboard press reaches the end.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(tap.last).toBeUndefined();
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
    expect(css).toMatch(/\.button\[aria-disabled='true'\]\s*\{[^}]*opacity:\s*0\.35/);
  });

  it('takes its screen reader name from label when given', () => {
    render(
      <Button variant="soft" size="round" label="한 번에 쓸 돈 5,000원 올리기" onPress={vi.fn()}>
        +
      </Button>,
    );
    const button = screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('draws the Budget stepper circle: 48 round, pale fill, 22/600 (Budget.dc.html)', () => {
    expect(css).toMatch(/\.round\s*\{[^}]*width:\s*var\(--size-button-secondary\)/);
    expect(css).toMatch(/\.round\s*\{[^}]*height:\s*var\(--size-button-secondary\)/);
    expect(css).toMatch(/\.round\s*\{[^}]*border-radius:\s*var\(--radius-chip\)/);
    expect(css).toMatch(/\.round\s*\{[^}]*font-size:\s*var\(--type-change-to-size\)/);
    expect(css).toMatch(/\.round\s*\{[^}]*font-weight:\s*var\(--type-label-weight\)/);
    expect(css).toMatch(/\.soft\s*\{[^}]*background:\s*var\(--color-track\)/);
  });
});
