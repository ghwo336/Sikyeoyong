import { describe, expect, it } from 'vitest';
import { zChatHistoryMessage } from '../api/chat.js';
import { CHAT_SESSION_IDLE_MS } from './chat-session.js';

describe('chat session (D-34)', () => {
  it('a conversation goes idle after three hours', () => {
    expect(CHAT_SESSION_IDLE_MS).toBe(10_800_000);
  });

  it('a history message may carry its session id, and old ones need none', () => {
    const base = { id: 'm1', role: 'user', text: '안녕' };
    expect(zChatHistoryMessage.parse({ ...base, sessionId: 's1' })).toMatchObject({
      sessionId: 's1',
    });
    expect(zChatHistoryMessage.parse(base)).toEqual(base);
    expect(zChatHistoryMessage.safeParse({ ...base, sessionId: '' }).success).toBe(false);
  });

  it('a history message may carry the time it was stored', () => {
    const base = { id: 'm1', role: 'user', text: '안녕' };
    expect(zChatHistoryMessage.parse({ ...base, createdAt: 1_700_000_000_000 })).toMatchObject({
      createdAt: 1_700_000_000_000,
    });
    expect(zChatHistoryMessage.safeParse({ ...base, createdAt: -1 }).success).toBe(false);
  });
});
