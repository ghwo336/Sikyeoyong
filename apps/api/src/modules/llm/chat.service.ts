import type Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  type AppErrorCode,
  type ChatEvent,
  renderDragonLine,
  type SendChatMessageBody,
  zChatEvent,
} from '@sikyeoyong/shared';
import { z } from 'zod';
import { uuidv7 } from '../../common/ids.js';
import { ChatRepository } from './chat.repository.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { AgentRuntime, type RuntimeEvent } from './runtime.js';
import { LlmToolHandlers } from './tools/handlers.js';

/** Said when the model refuses (D-22 left fallbacks to the server). Plain text, no claims. */
export const REFUSAL_LINE = '그건 제가 도와드리기 어려워용. 다른 걸 시켜 주세용.';

/** The code's dragon line; lines that need parameters fall back to the general one. */
function dragonLineFor(code: AppErrorCode): string {
  try {
    return renderDragonLine(code);
  } catch {
    return renderDragonLine('INTERNAL');
  }
}

/** Earlier turns the model sees (tech-spec 3.3 says 20). Only words, never old tool results. */
export const HISTORY_TURNS = 20;

const zUserContent = z.object({ text: z.string() });
const zAssistantContent = z.object({ events: z.array(zChatEvent) });

/** Streams one turn's events to the caller. */
export type ChatStream = (emit: (event: ChatEvent) => void) => Promise<void>;

function sameText(stored: string, text: string): boolean {
  return zUserContent.parse(JSON.parse(stored)).text === text;
}

function spokenText(events: readonly ChatEvent[]): string {
  return events.map((e) => (e.type === 'token' ? e.text : '')).join('');
}

/**
 * One user message in, a stream of ChatEvents out (tech-spec 2.4, 3.3). Every
 * event is checked against the shared schema before it leaves, so nothing the
 * model makes up can reach the screen outside the ChatEvent shapes.
 *
 * clientMessageId makes a resend safe (server-api.md): the same id and text
 * after a finished turn replays the stored answer without calling the model;
 * a different text, or a turn still running, is CONFLICT. A failed turn leaves
 * nothing behind, so the web can send it again.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly handlers: LlmToolHandlers,
    private readonly repo: ChatRepository,
  ) {}

  /** Checks and records the message before any byte is sent, so errors can still be HTTP errors. */
  begin(userId: string, body: SendChatMessageBody, nowMs: number = Date.now()): ChatStream {
    const existing = this.repo.findUserMessage(userId, body.clientMessageId);
    if (existing !== undefined) {
      const reply = this.repo.findReply(existing.id);
      if (!sameText(existing.contentJson, body.text) || reply === undefined) {
        throw new AppError('CONFLICT', { reason: 'clientMessageId already used' });
      }
      const events = zAssistantContent.parse(JSON.parse(reply.contentJson)).events;
      return (emit) => {
        events.forEach(emit);
        return Promise.resolve();
      };
    }
    const history = this.history(userId);
    const userRowId = uuidv7(nowMs);
    try {
      this.repo.insert({
        id: userRowId,
        userId,
        role: 'user',
        contentJson: JSON.stringify({ text: body.text }),
        clientMessageId: body.clientMessageId,
        replyToId: null,
        createdAt: nowMs,
      });
    } catch {
      // Lost a race with the same clientMessageId.
      throw new AppError('CONFLICT', { reason: 'clientMessageId already used' });
    }
    return (emit) => this.run(userId, body.text, history, userRowId, emit);
  }

  /** The last turns as plain words, oldest first; unanswered or silent turns are skipped. */
  private history(userId: string): Anthropic.MessageParam[] {
    const rows = this.repo.recent(userId, HISTORY_TURNS * 2).reverse();
    const answers = new Map(rows.filter((r) => r.replyToId !== null).map((r) => [r.replyToId, r]));
    const out: Anthropic.MessageParam[] = [];
    for (const row of rows) {
      if (row.role !== 'user') continue;
      const reply = answers.get(row.id);
      if (reply === undefined) continue;
      const said = spokenText(zAssistantContent.parse(JSON.parse(reply.contentJson)).events);
      if (said === '') continue;
      out.push({ role: 'user', content: zUserContent.parse(JSON.parse(row.contentJson)).text });
      out.push({ role: 'assistant', content: said });
    }
    return out;
  }

  private async run(
    userId: string,
    text: string,
    history: Anthropic.MessageParam[],
    userRowId: string,
    emit: (event: ChatEvent) => void,
  ): Promise<void> {
    const sent: ChatEvent[] = [];
    const send = (event: ChatEvent) => {
      const checked = zChatEvent.parse(event);
      if (checked.type !== 'tool_status') sent.push(checked);
      emit(checked);
    };
    const runtime = new AgentRuntime(this.provider, this.handlers.build());
    const turn = { refused: false };
    const onEvent = (e: RuntimeEvent) => {
      switch (e.type) {
        case 'token':
          send({ type: 'token', text: e.text });
          return;
        case 'tool_status':
          send({ type: 'tool_status', tool: e.tool, state: e.state });
          return;
        case 'tool_output':
          // Cards (recommendations, order_confirm, limit_change_card) map here as their modules land.
          return;
        case 'stopped':
          if (e.reason === 'refusal') turn.refused = true;
          return;
      }
    };
    try {
      await runtime.run({ ctx: { userId }, history, userText: text }, onEvent);
    } catch (err) {
      // The stream has started, so errors become the dragon's words, never a stack or a key.
      const code = err instanceof AppError ? err.code : 'INTERNAL';
      // Server log only: the cause and stack help operations and never reach the screen.
      this.logger.error(`chat turn failed: ${code}`, err instanceof Error ? err.stack : undefined);
      send({ type: 'token', text: dragonLineFor(code) });
      send({ type: 'done', messageId: userRowId });
      // Nothing is kept for a failed turn: the same message can be sent again.
      this.repo.delete(userRowId);
      return;
    }
    if (turn.refused) send({ type: 'token', text: REFUSAL_LINE });
    const replyId = uuidv7();
    send({ type: 'done', messageId: replyId });
    this.repo.insert({
      id: replyId,
      userId,
      role: 'assistant',
      contentJson: JSON.stringify({ events: sent }),
      clientMessageId: null,
      replyToId: userRowId,
      createdAt: Date.now(),
    });
  }
}
