import { describe, expect, it } from 'vitest';
import type { OrderQuote, RecommendationCard } from '../../../lib/api';
import { dragonTurn, historyEntries } from './entries';

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

  it('turns order_confirm into the quote, not a thread item', () => {
    const turn = dragonTurn('m', [{ type: 'order_confirm', quote }]);
    expect(turn.entries).toEqual([]);
    expect(turn.quote).toBe(quote);
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
