import { describe, expect, it } from 'vitest';
import { nameIs } from './steps';

describe('nameIs', () => {
  it('follows the last syllable of the dragon name', () => {
    expect(nameIs('용이')).toBe('용이예용');
    expect(nameIs('봄봄')).toBe('봄봄이에용');
    expect(nameIs('Yongi')).toBe('Yongi예용');
  });

  it('holds at the edges of the Hangul syllable block', () => {
    expect(nameIs('가')).toBe('가예용'); // 0xac00, first syllable, no final
    expect(nameIs('각')).toBe('각이에용'); // 0xac01, has a final
    expect(nameIs('힣')).toBe('힣이에용'); // 0xd7a3, last syllable, has a final
    expect(nameIs('\u{d7a4}')).toBe('\u{d7a4}예용'); // just past the block
    expect(nameIs('\u{abff}')).toBe('\u{abff}예용'); // just before the block
  });
});
