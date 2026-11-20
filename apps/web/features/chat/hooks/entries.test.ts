import { describe, expect, it } from 'vitest';
import type { LimitChangeCardView, OrderQuote, RecommendationCard } from '../../../lib/api';
import { type ChatEntry, dragonTurn, historyEntries, lastSent, threadRows } from './entries';

const rec = { id: 'r1', menu: '돼지국밥' } as RecommendationCard;
const quote = { orderId: 'o1' } as OrderQuote;

describe('dragonTurn', () => {
  it('joins tokens into one line and keeps cards in order', () => {
    const turn = dragonTurn('m', [
      { type: 'token', text: '비 오니까 ' },
      { type: 'token', text: '국물 어때용?' },
      { type: 'recommendations', items: [rec] },
      { type: 'quick_replies', items: [{ id: 'q', label: '돼지국밥으로' }] },
      { type: 'done', messageId: 'm' },
    ]);
    expect(turn.entries.map((e) => e.kind)).toEqual(['dragon', 'recommendations', 'quick_replies']);
    expect(turn.entries[0]).toMatchObject({ kind: 'dragon', text: '비 오니까 국물 어때용?' });
    expect(turn.quote).toBeUndefined();
  });

  it('draws the same recommendation list once when the model fetched it twice', () => {
    const other = { id: 'r2', menu: '순대국' } as RecommendationCard;
    const turn = dragonTurn('m', [
      { type: 'recommendations', items: [rec] },
      { type: 'token', text: '골랐어용' },
      { type: 'recommendations', items: [rec] },
      { type: 'recommendations', items: [other] },
    ]);
    expect(turn.entries.map((e) => e.kind)).toEqual([
      'recommendations',
      'dragon',
      'recommendations',
    ]);
  });

  it('turns order_confirm into the quote, not a thread item', () => {
    const turn = dragonTurn('m', [{ type: 'order_confirm', quote }]);
    expect(turn.entries).toEqual([]);
    expect(turn.quote).toBe(quote);
  });

  it('puts a limit change card after the words of its turn, before the chips', () => {
    // Browser QA 2: the card (later "바꿨어용!") sat above "아직 바뀌지 않았어용".
    const card = {
      cardId: 'c1',
      field: 'perOrder' as const,
      from: '1',
      to: '2',
      needsReauth: true,
      rows: [],
    } satisfies LimitChangeCardView;
    const turn = dragonTurn('m', [
      { type: 'token', text: '바꿀까용?' },
      { type: 'limit_change_card', card },
      { type: 'token', text: '버튼을 눌러야 바뀌어용.' },
      { type: 'quick_replies', items: [{ id: 'q', label: '그만' }] },
      { type: 'done', messageId: 'm' },
    ]);
    expect(turn.entries.map((e) => e.kind)).toEqual(['dragon', 'limit_change', 'quick_replies']);
    expect(turn.entries[0]).toMatchObject({ text: '바꿀까용?\n버튼을 눌러야 바뀌어용.' });
  });

  it('gives every item its own id even when a card kind repeats', () => {
    const turn = dragonTurn('m', [
      { type: 'recommendations', items: [rec] },
      { type: 'token', text: '하나 더' },
      { type: 'recommendations', items: [rec] },
    ]);
    const ids = turn.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('historyEntries', () => {
  it('keeps user messages as sent bubbles between dragon turns', () => {
    const entries = historyEntries([
      { id: 'u1', role: 'user', text: '점심 시켜 줘' },
      { id: 'd1', role: 'dragon', events: [{ type: 'token', text: '좋아용' }] },
    ]);
    expect(entries).toEqual([
      { kind: 'user', id: 'u1', text: '점심 시켜 줘', status: 'sent' },
      { kind: 'dragon', id: 'd1-t0', text: '좋아용' },
    ]);
  });
});

describe('threadRows', () => {
  const dragon = (id: string): ChatEntry => ({ kind: 'dragon', id, text: id });
  const recs = (id: string): ChatEntry => ({ kind: 'recommendations', id, items: [rec] });
  const chips = (id: string): ChatEntry => ({ kind: 'quick_replies', id, items: [] });
  const user = (id: string): ChatEntry => ({ kind: 'user', id, text: id, status: 'sent' });

  it('puts recommendations right after a dragon line under that line', () => {
    const rows = threadRows([user('u'), dragon('d'), recs('r'), chips('q')]);
    expect(rows.map((r) => r.entry.id)).toEqual(['u', 'd', 'q']);
    expect(rows[1]?.cards?.id).toBe('r');
    expect(rows.map((r) => r.last)).toEqual([false, false, true]);
  });

  it('a card sent just before the line rides with that line too (tool first, then words)', () => {
    const rows = threadRows([user('u'), recs('r'), dragon('d')]);
    expect(rows.map((r) => [r.entry.id, r.cards?.id])).toEqual([
      ['u', undefined],
      ['d', 'r'],
    ]);
    expect(rows[1]?.last).toBe(true);
  });

  it('a card with no dragon line next to it stands alone', () => {
    const rows = threadRows([user('u'), recs('r'), user('u2')]);
    expect(rows.map((r) => [r.entry.id, r.cards?.id])).toEqual([
      ['u', undefined],
      ['r', undefined],
      ['u2', undefined],
    ]);
  });

  it('marks the dragon row last when its card ends the thread', () => {
    const rows = threadRows([dragon('d'), recs('r')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ last: true, cards: { id: 'r' } });
  });

  it('takes only the first card after a line; a second one stands alone', () => {
    const rows = threadRows([dragon('d'), recs('r1'), recs('r2')]);
    expect(rows.map((r) => [r.entry.id, r.cards?.id, r.last])).toEqual([
      ['d', 'r1', false],
      ['r2', undefined, true],
    ]);
  });

  it('is empty for an empty thread', () => {
    expect(threadRows([])).toEqual([]);
  });
});

describe('lastSent', () => {
  it("is the user's newest message id, past any dragon lines after it", () => {
    const entries: ChatEntry[] = [
      { kind: 'user', id: 'u1', text: '안녕', status: 'sent' },
      { kind: 'dragon', id: 'd1', text: '안녕하세용' },
      { kind: 'user', id: 'u2', text: '국밥', status: 'sending' },
      { kind: 'dragon', id: 'd2', text: '찾아볼게용' },
    ];
    expect(lastSent(entries)).toBe('u2');
  });

  it('is undefined before the user says anything', () => {
    expect(lastSent([{ kind: 'dragon', id: 'd1', text: '안녕하세용' }])).toBeUndefined();
  });
});
