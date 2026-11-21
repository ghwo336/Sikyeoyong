import { describe, expect, it } from 'vitest';
import { MenuCatalog } from './chosen-menu.js';

function catalog(): MenuCatalog {
  const c = new MenuCatalog();
  c.learn({
    menus: [
      { menuId: 'soup', menu: '돼지국밥' },
      { menuId: 'tteok', menu: '국물떡볶이' },
      { menuId: 'fry', menu: '튀김세트' },
      { menuId: 'rice', menu: '순대국밥' },
    ],
  });
  return c;
}
function single(): MenuCatalog {
  const c = new MenuCatalog();
  c.learn({
    menus: [
      { menuId: 'soup', menu: '돼지국밥' },
      { menuId: 'fry', menu: '튀김세트' },
    ],
  });
  return c;
}

describe('MenuCatalog.named', () => {
  it('names the one menu that contains a partial word', () => {
    expect(single().named('국밥 시켜 줘')).toEqual(['soup']);
    expect(single().swappedAway('국밥 시켜 줘', ['fry'])).toEqual(['돼지국밥']);
  });
  it('names nothing for an ambiguous partial', () => {
    expect(catalog().named('국밥 시켜 줘')).toEqual([]);
  });
  it('ignores one-char words and refused partials', () => {
    expect(single().named('밥 줘')).toEqual([]);
    expect(single().named('국밥 말고 다른 거')).toEqual([]);
  });
  it.each(['국물떡볶이 별로야', '국물떡볶이 질렸어', '국물떡볶이 됐어', '국물떡볶이 안 땡겨'])(
    'treats a refusal after the name as a refusal: %s',
    (text) => {
      expect(catalog().named(text)).toEqual([]);
    },
  );
  it('reads "A 아니면 B" as a choice, not a refusal of A', () => {
    expect(catalog().named('튀김세트 아니면 국물떡볶이').sort()).toEqual(['fry', 'tteok'].sort());
  });

  it('refuses only the name before 아니고', () => {
    expect(catalog().named('튀김세트 아니고 국물떡볶이')).toEqual(['tteok']);
  });
  it('does not refuse the name after an interjection 아니', () => {
    expect(catalog().named('아니 국물떡볶이 시켜 줘')).toEqual(['tteok']);
  });
  it('still names a plain order', () => {
    expect(catalog().named('국물떡볶이 시켜 줘')).toEqual(['tteok']);
  });
});
