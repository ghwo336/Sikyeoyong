import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';

type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

/** Anthropic tool definitions to OpenAI function tools (not strict: the server re-checks inputs with zod, D-30). */
export function toChatTools(tools: Anthropic.Tool[]): ChatTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      ...(t.description === undefined ? {} : { description: t.description }),
      parameters: t.input_schema,
    },
  }));
}
