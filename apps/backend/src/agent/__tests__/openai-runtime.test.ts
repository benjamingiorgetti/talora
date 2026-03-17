import { describe, it, expect } from 'bun:test';
import { buildOpenAiMessages } from '../openai-runtime';

const SYSTEM_PROMPT = 'You are a helpful assistant.';

function toolCall(id: string, name: string) {
  return [{ id, type: 'function', function: { name, arguments: '{}' } }];
}

describe('buildOpenAiMessages', () => {
  it('preserves valid assistant+tool sequences', () => {
    const messages = [
      { role: 'user' as const, content: 'Book me a slot', tool_calls: null, tool_call_id: null },
      { role: 'assistant' as const, content: null, tool_calls: toolCall('tc_1', 'check_availability'), tool_call_id: null },
      { role: 'tool' as const, content: '{"available": true}', tool_calls: null, tool_call_id: 'tc_1' },
      { role: 'assistant' as const, content: 'Done!', tool_calls: null, tool_call_id: null },
    ];

    const result = buildOpenAiMessages(SYSTEM_PROMPT, messages);

    const toolMsg = result.find((m) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect((toolMsg as any).tool_call_id).toBe('tc_1');
  });

  it('drops orphaned tool messages when assistant has no tool_calls', () => {
    const messages = [
      { role: 'user' as const, content: 'hi', tool_calls: null, tool_call_id: null },
      { role: 'assistant' as const, content: 'thinking...', tool_calls: null, tool_call_id: null },
      { role: 'tool' as const, content: '{"result": true}', tool_calls: null, tool_call_id: 'tc_orphan' },
    ];

    const result = buildOpenAiMessages(SYSTEM_PROMPT, messages);

    expect(result.filter((m) => m.role === 'tool')).toHaveLength(0);
  });

  it('drops tool messages when preceding assistant is missing from history (LIMIT cutoff)', () => {
    // History starts with a tool message — the assistant that called it was cut by LIMIT 20
    const messages = [
      { role: 'tool' as const, content: '{"ok": true}', tool_calls: null, tool_call_id: 'tc_cut' },
      { role: 'assistant' as const, content: 'Here you go', tool_calls: null, tool_call_id: null },
      { role: 'user' as const, content: 'thanks', tool_calls: null, tool_call_id: null },
    ];

    const result = buildOpenAiMessages(SYSTEM_PROMPT, messages);

    expect(result.filter((m) => m.role === 'tool')).toHaveLength(0);
  });

  it('drops tool messages when assistant has empty tool_calls array', () => {
    const messages = [
      { role: 'user' as const, content: 'do something', tool_calls: null, tool_call_id: null },
      { role: 'assistant' as const, content: 'ok', tool_calls: [], tool_call_id: null },
      { role: 'tool' as const, content: '{"done": true}', tool_calls: null, tool_call_id: 'tc_empty' },
    ];

    const result = buildOpenAiMessages(SYSTEM_PROMPT, messages);

    expect(result.filter((m) => m.role === 'tool')).toHaveLength(0);
  });

  it('keeps valid tool messages and drops invalid ones in mixed history', () => {
    const messages = [
      { role: 'user' as const, content: 'check', tool_calls: null, tool_call_id: null },
      { role: 'assistant' as const, content: null, tool_calls: toolCall('tc_a', 'tool_a'), tool_call_id: null },
      { role: 'tool' as const, content: 'result_a', tool_calls: null, tool_call_id: 'tc_a' },
      { role: 'tool' as const, content: 'result_orphan', tool_calls: null, tool_call_id: 'tc_missing' },
      { role: 'assistant' as const, content: 'done', tool_calls: null, tool_call_id: null },
    ];

    const result = buildOpenAiMessages(SYSTEM_PROMPT, messages);

    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(1);
    expect((toolMsgs[0] as any).tool_call_id).toBe('tc_a');
  });
});
