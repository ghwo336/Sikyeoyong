import { describe, expect, it } from 'vitest';
import { nameIs } from './steps';

describe('nameIs', () => {
  it('follows the last syllable of the dragon name', () => {
    expect(nameIs('용이')).toBe('용이예용');
    expect(nameIs('봄봄')).toBe('봄봄이에용');
    expect(nameIs('Yongi')).toBe('Yongi예용');
  });
});
