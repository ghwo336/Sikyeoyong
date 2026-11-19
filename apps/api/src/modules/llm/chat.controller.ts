import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { type SendChatMessageBody, zSendChatMessageBody } from '@sikyeoyong/shared';
import type { Response } from 'express';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { ChatService } from './chat.service.js';

/** POST /api/chat/messages: SSE stream of ChatEvent (tech-spec 2.4). HTTP and SSE framing only. */
@Controller('chat')
@UseGuards(SessionGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('messages')
  async send(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zSendChatMessageBody)) body: SendChatMessageBody,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    try {
      await this.chat.send(user.userId, body, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    } finally {
      // Headers are sent, so the error filter cannot answer any more; always close the stream.
      res.end();
    }
  }
}
