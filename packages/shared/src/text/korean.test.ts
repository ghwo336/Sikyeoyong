import { describe, expect, it } from 'vitest';
import { levelWithRo } from './korean.js';

// Moved from packages/ui LimitBlocked. Read aloud: 일로, 이로, 삼으로, ... 십으로, 십일로.
describe('levelWithRo', () => {
  it.each([
    [1, '1로'],
    [2, '2로'],
    [3, '3으로'],
    [4, '4로'],
    [5, '5로'],
    [6, '6으로'],
    [7, '7로'],
    [8, '8로'],
    [9, '9로'],
    [10, '10으로'],
    [11, '11로'],
    [13, '13으로'],
    [100, '100으로'],
  ])('reads level %s as %s', (level, text) => {
    expect(levelWithRo(level)).toBe(text);
  });
});
