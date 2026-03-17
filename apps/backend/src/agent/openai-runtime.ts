import type OpenAI from 'openai';
import { deserializeToolCalls } from './utils';
import type { AgentTool, Message, TestMessage } from '@talora/shared';

type RuntimeHistoryMessage = Pick<Message, 'role' | 'content' | 'tool_calls' | 'tool_call_id'> | Pick<TestMessage, 'role' | 'content' | 'tool_calls' | 'tool_call_id'>;

export function buildOpenAiTools(tools: AgentTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters:
        tool.parameters && typeof tool.parameters === 'object' && Object.keys(tool.parameters).length > 0
          ? tool.parameters as Record<string, unknown>
          : { type: 'object', properties: {} },
    },
  }));
}

export function buildOpenAiMessages(
  systemPrompt: string,
  messages: RuntimeHistoryMessage[],
  options: {
    mapToolContent?: (message: RuntimeHistoryMessage) => string;
  } = {},
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const message of messages) {
    if (message.role === 'user') {
      openaiMessages.push({ role: 'user', content: message.content || '' });
      continue;
    }

    if (message.role === 'assistant') {
      if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        openaiMessages.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: deserializeToolCalls(message.tool_calls),
        });
      } else {
        openaiMessages.push({ role: 'assistant', content: message.content || '' });
      }
      continue;
    }

    if (message.role === 'tool') {
      openaiMessages.push({
        role: 'tool',
        tool_call_id: message.tool_call_id || '',
        content: options.mapToolContent ? options.mapToolContent(message) : (message.content || ''),
      });
    }
  }

  // Sanitize: drop orphaned tool messages whose tool_call_id has no matching assistant
  const validToolCallIds = new Set<string>();
  for (const msg of openaiMessages) {
    if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        validToolCallIds.add(tc.id);
      }
    }
  }

  return openaiMessages.filter((msg) => {
    if (msg.role === 'tool') {
      return validToolCallIds.has((msg as { tool_call_id: string }).tool_call_id);
    }
    return true;
  });
}
