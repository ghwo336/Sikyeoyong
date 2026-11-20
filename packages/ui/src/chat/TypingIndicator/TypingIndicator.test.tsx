import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypingIndicator } from './TypingIndicator';

const css = readFileSync(resolve(__dirname, 'TypingIndicator.module.css'), 'utf8');

describe('TypingIndicator (TypingIndicator.md 테스트 기준)', () => {
  it('tells screen readers the dragon is writing, with its 32px face and three dots', () => {
    const { container } = render(<TypingIndicator species="water" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('용이가 답을 쓰고 있어요');
    expect(container.querySelector('svg[data-species="water"][width="32"]')).not.toBeNull();
    expect(container.querySelectorAll('.dot')).toHaveLength(3);
  });

  it('blinks on the motion.typing token and stands still for reduced motion', () => {
    expect(css).toMatch(/animation:\s*blink var\(--motion-typing\)/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.dot\s*\{\s*animation:\s*none/);
    expect(css).toMatch(/gap:\s*var\(--size-dragon-chat-gap\)/);
  });
});
