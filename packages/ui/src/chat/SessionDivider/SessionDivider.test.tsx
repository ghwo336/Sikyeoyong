import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionDivider } from './SessionDivider';

const css = readFileSync(resolve(__dirname, 'SessionDivider.module.css'), 'utf8');

describe('SessionDivider (SessionDivider.md 테스트 기준)', () => {
  it('shows the label as plain text with no button', () => {
    render(<SessionDivider label="11월 21일 저녁" />);
    expect(screen.getByText('11월 21일 저녁')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is centered, uses the stamp type and secondary ink', () => {
    expect(css).toMatch(/align-self:\s*center/);
    expect(css).toMatch(/var\(--type-stamp-size\)/);
    expect(css).toMatch(/var\(--color-ink-secondary\)/);
  });
});
