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
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { approvalWaitEvents } from './approval-wait.js';
import { ChatRepository } from './chat.repository.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { AgentRuntime, type RuntimeEvent } from './runtime.js';
import { LlmToolHandlers } from './tools/handlers.js';
import type { ToolCard, ToolName } from './tools/index.js';

/** The one card type each tool may put on screen (tech-spec 2.4). Others are dropped. */
export const CARD_OF_TOOL: Partial<Record<ToolName, ChatEvent['type']>> = {
  recommend_merchants: 'recommendations',
  place_order: 'order_confirm',
  propose_limit_change: 'limit_change_card',
};

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

/** tech-spec 9.5: 20 chat messages a minute per user. Replays of finished turns do not count. */
export const CHAT_RATE = { limit: 20, windowMs: 60_000 } as const;

/** Earlier turns the model sees (tech-spec 3.3 says 20). Only words, never old tool results. */
export const HISTORY_TURNS = 20;

const zUserContent = z.object({ text: z.string() });
const zAssistantContent = z.object({ events: z.array(zChatEvent) });
/** History needs only the words, so it reads stored turns loosely: a later ChatEvent change must not lock anyone out. */
const zSpoken = z.object({
  events: z.array(z.unknown()).transform((events) =>
    events
      .map((e) => {
        const token = z.object({ type: z.literal('token'), text: z.string() }).safeParse(e);
        return token.success ? token.data.text : '';
      })
      .join(''),
  ),
});

function readJson<T>(schema: z.ZodType<T>, json: string): T | null {
  try {
    const r = schema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Streams one turn's events to the caller. */
export type ChatStream = (emit: (event: ChatEvent) => void, signal?: AbortSignal) => Promise<void>;

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
  /** Users with a turn running now: a second message waits for the first (no parallel cost). */
  private readonly running = new Set<string>();

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly handlers: LlmToolHandlers,
    private readonly repo: ChatRepository,
    private readonly limiter: RateLimiter,
  ) {}

  /** Checks and records the message before any byte is sent, so errors can still be HTTP errors. */
  begin(userId: string, body: SendChatMessageBody, nowMs: number = Date.now()): ChatStream {
    const existing = this.repo.findUserMessage(userId, body.clientMessageId);
    if (existing !== undefined) {
      const reply = this.repo.findReply(existing.id);
      const sameText = readJson(zUserContent, existing.contentJson)?.text === body.text;
      const stored = reply === undefined ? null : readJson(zAssistantContent, reply.contentJson);
      if (!sameText || stored === null) {
        // A different text, a turn still running, or a stored answer this version cannot replay.
        throw new AppError('CONFLICT', { reason: 'clientMessageId already used' });
      }
      const events = stored.events;
      return (emit) => {
        events.forEach(emit);
        return Promise.resolve();
      };
    }
    // One turn at a time per user: close-and-resend loops must not multiply model cost.
    // Refused as CONFLICT (409), which the web already shows as the dragon's wait line.
    if (this.running.has(userId)) {
      throw new AppError('CONFLICT', { reason: 'a turn is still running' });
    }
    if (!this.limiter.allow(`chat:${userId}`, CHAT_RATE, nowMs)) {
      throw new AppError('RATE_LIMITED', { reason: 'chat rate' });
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
    return async (emit, signal) => {
      // Taken in the same tick as begin() (the controller does not await between them).
      this.running.add(userId);
      try {
        await this.run(userId, body.text, history, userRowId, emit, signal);
      } finally {
        this.running.delete(userId);
      }
    };
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
      const asked = readJson(zUserContent, row.contentJson)?.text;
      const said = readJson(zSpoken, reply.contentJson)?.events;
      if (asked === undefined || said === undefined) {
        this.logger.warn(`skipped an unreadable stored turn ${row.id}`);
        continue;
      }
      if (asked === '' || said === '') continue;
      out.push({ role: 'user', content: asked });
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
    signal?: AbortSignal,
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
          if (e.card !== undefined) {
            const card = this.cardEvent(e.tool, e.card);
            if (card !== null) send(card);
          }
          return;
        case 'approval_wait':
          // Server words for the wait, never the model's (agent-runtime.md "허락 대기").
          approvalWaitEvents(
            e.reason,
            sent.some((s) => s.type === 'token' && s.text !== ''),
          ).forEach(send);
          return;
        case 'stopped':
          if (e.reason === 'refusal') turn.refused = true;
          return;
      }
    };
    try {
      await runtime.run({ ctx: { userId }, history, userText: text }, onEvent, signal);
    } catch (err) {
      if (signal?.aborted) {
        if (
          !(err instanceof Error && err.message === 'aborted') &&
          !(err instanceof Error && err.name === 'AbortError')
        ) {
          this.logger.warn(
            'chat turn error after the client left',
            err instanceof Error ? err.stack : undefined,
          );
        }
        // Nobody is listening: keep nothing so the same message can be sent again.
        this.store(() => {
          this.repo.delete(userRowId);
        });
        return;
      }
      // The stream has started, so errors become the dragon's words, never a stack or a key.
      const code = err instanceof AppError ? err.code : 'INTERNAL';
      // Server log only: the cause and stack help operations and never reach the screen.
      this.logger.error(`chat turn failed: ${code}`, err instanceof Error ? err.stack : undefined);
      send({ type: 'token', text: dragonLineFor(code) });
      // messageId names a stored answer; a failed turn stores none, so it gets a fresh id.
      send({ type: 'done', messageId: uuidv7() });
      // Nothing is kept for a failed turn: the same message can be sent again.
      this.store(() => {
        this.repo.delete(userRowId);
      });
      return;
    }
    if (signal?.aborted) {
      this.store(() => {
        this.repo.delete(userRowId);
      });
      return;
    }
    if (turn.refused) send({ type: 'token', text: REFUSAL_LINE });
    const replyId = uuidv7();
    send({ type: 'done', messageId: replyId });
    this.store(() => {
      this.repo.insert({
        id: replyId,
        userId,
        role: 'assistant',
        contentJson: JSON.stringify({ events: sent }),
        clientMessageId: null,
        replyToId: userRowId,
        createdAt: Date.now(),
      });
    });
  }

  /**
   * A tool's screen card as a ChatEvent, or null to drop it. Only the card type
   * that tool owns (CARD_OF_TOOL) and only shapes zChatEvent accepts reach the
   * screen; anything else is a server bug, logged and dropped without the card's
   * content so the turn and its words still go on.
   */
  private cardEvent(tool: ToolName, card: ToolCard): ChatEvent | null {
    if (CARD_OF_TOOL[tool] !== card.type) {
      this.logger.error(`dropped a ${card.type} card from ${tool}: not its card type`);
      return null;
    }
    const checked = zChatEvent.safeParse(card);
    if (!checked.success) {
      const paths = checked.error.issues.map((i) => i.path.join('.') || '(root)').join(', ');
      this.logger.error(`dropped a ${card.type} card from ${tool}: invalid at ${paths}`);
      return null;
    }
    return checked.data;
  }

  /** The answer is already on screen; a storage failure is logged, never thrown into the closed stream. */
  private store(write: () => void): void {
    try {
      write();
    } catch (err) {
      this.logger.error('chat storage failed', err instanceof Error ? err.stack : undefined);
    }
  }
}
