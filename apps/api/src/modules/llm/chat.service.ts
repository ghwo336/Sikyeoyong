import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  type AppErrorCode,
  type ChatEvent,
  renderDragonLine,
  type SendChatMessageBody,
  zChatEvent,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
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

/**
 * One user message in, a stream of ChatEvents out (tech-spec 2.4, 3.3). Every
 * event is checked against the shared schema before it leaves, so nothing the
 * model makes up can reach the screen outside the ChatEvent shapes.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly handlers: LlmToolHandlers,
  ) {}

  async send(
    userId: string,
    body: SendChatMessageBody,
    emit: (event: ChatEvent) => void,
  ): Promise<void> {
    const send = (event: ChatEvent) => {
      emit(zChatEvent.parse(event));
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
      await runtime.run({ ctx: { userId }, history: [], userText: body.text }, onEvent);
    } catch (err) {
      // The stream has started, so errors become the dragon's words, never a stack or a key.
      const code = err instanceof AppError ? err.code : 'INTERNAL';
      // Server log only: the cause and stack help operations and never reach the screen.
      this.logger.error(`chat turn failed: ${code}`, err instanceof Error ? err.stack : undefined);
      send({ type: 'token', text: dragonLineFor(code) });
    }
    if (turn.refused) send({ type: 'token', text: REFUSAL_LINE });
    send({ type: 'done', messageId: uuidv7() });
  }
}
