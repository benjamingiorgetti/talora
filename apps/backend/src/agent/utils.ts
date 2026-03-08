import type OpenAI from 'openai';

export function deserializeToolCalls(toolCalls: unknown[]): OpenAI.Chat.ChatCompletionMessageToolCall[] {
  return toolCalls
    .filter((tc): tc is Record<string, unknown> => tc !== null && typeof tc === 'object')
    .map((tc) => {
      if (tc.function && typeof tc.function === 'object') {
        return {
          id: tc.id as string,
          type: 'function' as const,
          function: {
            name: (tc.function as Record<string, unknown>).name as string,
            arguments: (tc.function as Record<string, unknown>).arguments as string,
          },
        };
      }
      return null;
    })
    .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
}
