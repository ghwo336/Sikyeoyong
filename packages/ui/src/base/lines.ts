import { createElement, type ReactNode } from 'react';

/**
 * Turns "첫 줄\n둘째 줄" into the lines with a <br> between them. Words come as plain strings
 * with "\n" where the design breaks the line (DragonLine, ScreenTitle). Nothing is clipped.
 */
export function lines(text: string): ReactNode[] {
  return text
    .split('\n')
    .map((line, i) => createElement('span', { key: i }, i > 0 ? createElement('br') : null, line));
}
