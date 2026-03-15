// @ts-nocheck
/**
 * Unit tests for agent orchestration logic.
 *
 * All external dependencies are mocked before dynamic import to ensure
 * full isolation. No real network calls, DB, or OpenAI API are used.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { makeConversation, makeMessage, makeAgent, TEST_IDS } from '../../__test-utils__/factories';
import { createMockQuery, setupQueryMock } from '../../__test-utils__/mock-pool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOpenAiResponse(
  content: string,
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>,
) {
  return {
    choices: [
      {
        message: {
          role: 'assistant' as const,
          content,
          tool_calls: toolCalls ?? null,
        },
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Stable mock instances — declared once, never re-assigned.
// Use .mockReset() / .mockImplementation() to change behavior per test.
// ---------------------------------------------------------------------------

const mockQuery = createMockQuery();
const mockSendText = mock(() => Promise.resolve({ key: { id: 'msg-evo-test' } }));
const mockOpenAiCreate = mock(() =>
  Promise.resolve(mockOpenAiResponse('Hola, ¿en qué te puedo ayudar?')),
);
const mockExecuteTool = mock(() => Promise.resolve(JSON.stringify({ ok: true })));
const mockBuildSystemPrompt = mock(() => 'test prompt');
const mockBuildOpenAiMessages = mock(() => [{ role: 'system' as const, content: 'test prompt' }]);
const mockBuildOpenAiTools = mock((): unknown[] => []);
const mockGetAgentConfig = mock(() =>
  Promise.resolve({
    agent: makeAgent(),
    sections: [],
    tools: [],
    variables: [],
  }),
);
const mockCheckSlot = mock(() => Promise.resolve({ available: true }));
const mockWithTimeout = mock(<T>(p: Promise<T>) => p);
const mockLoggerError = mock(() => {});
const mockLoggerInfo = mock(() => {});

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE dynamic import
// ---------------------------------------------------------------------------

mock.module('../../db/pool', () => ({ pool: { query: mockQuery } }));

mock.module('../../config', () => ({
  config: {
    openaiApiKey: 'test-openai-key',
    evolutionApiUrl: 'http://evolution.test',
    evolutionApiKey: 'test-evo-key',
    timezone: 'America/Argentina/Buenos_Aires',
    maxToolIterations: 10,
    agentTimeoutMs: 120_000,
    toolTimeoutMs: 60_000,
  },
}));

mock.module('../../evolution/client', () => ({
  EvolutionClient: class MockEvolutionClient {
    // Use stable mock reference so tests can assert on it
    sendText = mockSendText;
    getInstanceStatus = mock(() => Promise.resolve({ state: 'open' }));
  },
}));

mock.module('./tool-executor', () => ({
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
}));

mock.module('./prompt-builder', () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
}));

mock.module('../../calendar/operations', () => ({
  checkSlot: (...args: unknown[]) => mockCheckSlot(...args),
  bookSlot: mock(() => Promise.resolve({ eventId: 'evt-test' })),
  deleteEvent: mock(() => Promise.resolve({ success: true })),
  updateEvent: mock(() => Promise.resolve({ eventId: 'evt-test' })),
  createEvent: mock(() => Promise.resolve({ eventId: 'evt-test' })),
  listEvents: mock(() => Promise.resolve({ events: [] })),
}));

mock.module('../../cache/agent-cache', () => ({
  getAgentConfig: (...args: unknown[]) => mockGetAgentConfig(...args),
}));

mock.module('../../utils/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mock(() => {}),
    debug: mock(() => {}),
  },
}));

mock.module('../../utils/timeout', () => ({
  withTimeout: <T>(p: Promise<T>) => mockWithTimeout(p),
}));

mock.module('./openai-runtime', () => ({
  buildOpenAiMessages: (...args: unknown[]) => mockBuildOpenAiMessages(...args),
  buildOpenAiTools: (...args: unknown[]) => mockBuildOpenAiTools(...args),
}));

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        // Forward to the stable mock so tests can re-configure it
        create: (...args: unknown[]) => mockOpenAiCreate(...args),
      },
    };
    constructor() {}
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports — must happen AFTER mock.module calls
// ---------------------------------------------------------------------------

const { handleIncomingMessage, safeJsonParse, buildAgentToolTrace } = await import('../index');

// ---------------------------------------------------------------------------
// DB response helpers
// ---------------------------------------------------------------------------

function setupDefaultDbResponses() {
  setupQueryMock(mockQuery, [
    ['SELECT * FROM conversations WHERE id', [makeConversation()]],
    ['SELECT * FROM messages WHERE conversation_id', [makeMessage()]],
    // recent bookings summary query
    ['FROM appointments a', []],
    // INSERT INTO messages returning new id (assistant final)
    ['INSERT INTO messages (conversation_id, role, content)\n       VALUES ($1, \'assistant\', $2)\n       RETURNING id', [{ id: 'msg-new-001' }]],
    // INSERT INTO agent_message_traces
    ['INSERT INTO agent_message_traces', []],
    // UPDATE conversations SET last_message_at
    ['UPDATE conversations SET last_message_at', []],
  ]);
}

// ---------------------------------------------------------------------------
// Tests: pure helpers — no orchestration setup required
// ---------------------------------------------------------------------------

describe('safeJsonParse', () => {
  it('should return parsed object when input is valid JSON object', () => {
    const result = safeJsonParse('{"key":"value","count":3}');
    expect(result).toEqual({ key: 'value', count: 3 });
  });

  it('should return raw string when input is invalid JSON', () => {
    const result = safeJsonParse('esto no es json');
    expect(result).toBe('esto no es json');
  });

  it('should return raw string when JSON value is an array (not a plain object)', () => {
    const result = safeJsonParse('[1, 2, 3]');
    expect(result).toBe('[1, 2, 3]');
  });

  it('should return raw string for empty string', () => {
    const result = safeJsonParse('');
    expect(result).toBe('');
  });
});

describe('buildAgentToolTrace', () => {
  it('should build a trace with status=success when result has no error field', () => {
    const trace = buildAgentToolTrace(
      'call-id-1',
      'some_tool',
      { param: 'value' },
      JSON.stringify({ result: 'ok' }),
    );

    expect(trace.tool_call_id).toBe('call-id-1');
    expect(trace.name).toBe('some_tool');
    expect(trace.status).toBe('success');
    expect(trace.input).toEqual({ param: 'value' });
    expect(trace.output).toEqual({ result: 'ok' });
    expect(trace.error).toBeNull();
  });

  it('should build a trace with status=error when result contains an error field', () => {
    const trace = buildAgentToolTrace(
      'call-id-err',
      'failing_tool',
      { param: 'bad' },
      JSON.stringify({ error: 'Something went wrong' }),
    );

    expect(trace.status).toBe('error');
    expect(trace.error).toBe('Something went wrong');
  });

  it('should set status=success and keep raw string output for non-JSON results', () => {
    const trace = buildAgentToolTrace('call-id-raw', 'raw_tool', {}, 'plain text result');

    expect(trace.status).toBe('success');
    expect(trace.output).toBe('plain text result');
    expect(trace.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: orchestration — happy path
// ---------------------------------------------------------------------------

describe('handleIncomingMessage — single-turn (no tool calls)', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockReset();
    mockExecuteTool.mockReset();
    mockOpenAiCreate.mockReset();
    mockLoggerError.mockReset();
    setupDefaultDbResponses();
    mockOpenAiCreate.mockImplementation(() =>
      Promise.resolve(mockOpenAiResponse('Claro, te ayudo con el turno.')),
    );
  });

  it('should call evolution.sendText with the assistant response', async () => {
    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'Quiero un turno');

    expect(mockSendText).toHaveBeenCalledTimes(1);
    const [instanceArg, , textArg] = mockSendText.mock.calls[0] as [string, string, string];
    expect(instanceArg).toBe('test-instance');
    expect(textArg).toBe('Claro, te ayudo con el turno.');
  });

  it('should NOT call executeTool when OpenAI returns no tool calls', async () => {
    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'Hola');

    expect(mockExecuteTool).not.toHaveBeenCalled();
  });

  it('should NOT send a WhatsApp message when OpenAI returns empty content', async () => {
    mockOpenAiCreate.mockImplementation(() => Promise.resolve(mockOpenAiResponse('')));

    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'Hola');

    expect(mockSendText).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: tool call flow
// ---------------------------------------------------------------------------

describe('handleIncomingMessage — tool call flow', () => {
  const TOOL_CALL = {
    id: 'call-tool-001',
    type: 'function' as const,
    function: {
      name: 'check_availability',
      arguments: JSON.stringify({ date: '2026-03-15' }),
    },
  };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockReset();
    mockExecuteTool.mockReset();
    mockOpenAiCreate.mockReset();
    // Restore default agent config in case a prior suite left it as null
    mockGetAgentConfig.mockImplementation(() =>
      Promise.resolve({ agent: makeAgent(), sections: [], tools: [], variables: [] }),
    );
    setupDefaultDbResponses();
  });

  it('should execute the tool loop and send the follow-up response via Evolution', async () => {
    mockExecuteTool.mockImplementation(() => Promise.resolve(JSON.stringify({ available: true })));

    // First call returns tool_calls; second returns the final text
    let callCount = 0;
    mockOpenAiCreate.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(mockOpenAiResponse('', [TOOL_CALL]));
      }
      return Promise.resolve(mockOpenAiResponse('Mañana tienes disponibilidad.'));
    });

    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'Hay lugar mañana?');

    // OpenAI must be called twice: once to get the tool_call, once for the follow-up
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);

    // The final assistant text must be sent via Evolution
    expect(mockSendText).toHaveBeenCalledTimes(1);
    const textSent = (mockSendText.mock.calls[0] as [string, string, string])[2];
    expect(textSent).toBe('Mañana tienes disponibilidad.');
  });
});

// ---------------------------------------------------------------------------
// Tests: iteration guard
// ---------------------------------------------------------------------------

describe('handleIncomingMessage — max iterations guard', () => {
  const TOOL_CALL = {
    id: 'call-loop-001',
    type: 'function' as const,
    function: {
      name: 'infinite_tool',
      arguments: JSON.stringify({}),
    },
  };

  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockReset();
    mockExecuteTool.mockReset();
    mockOpenAiCreate.mockReset();
    mockLoggerError.mockReset();
    setupDefaultDbResponses();
  });

  it('should stop the loop after maxToolIterations and log an error', async () => {
    mockExecuteTool.mockImplementation(() => Promise.resolve('{}'));
    // Always return a tool call — the iteration guard (maxToolIterations=10) must cut it off
    mockOpenAiCreate.mockImplementation(() =>
      Promise.resolve(mockOpenAiResponse('', [TOOL_CALL])),
    );

    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'trigger loop');

    // executeTool must have been called at most maxToolIterations times
    expect(mockExecuteTool.mock.calls.length).toBeLessThanOrEqual(10);

    // logger.error should have been called with a message mentioning 'iterations'
    const allErrorArgs = (mockLoggerError.mock.calls as unknown[][]).flat();
    const hasIterationError = allErrorArgs.some(
      (arg) => typeof arg === 'string' && arg.includes('iterations'),
    );
    expect(hasIterationError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: early-exit conditions
// ---------------------------------------------------------------------------

describe('handleIncomingMessage — conversation does not exist', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockReset();
    mockOpenAiCreate.mockReset();
    // Return empty rows → processMessage should return early
    setupQueryMock(mockQuery, [
      ['SELECT * FROM conversations WHERE id', []],
    ]);
  });

  it('should return early without calling OpenAI or sendText', async () => {
    await handleIncomingMessage('non-existent-id', 'test-instance', 'Hola');

    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });
});

describe('handleIncomingMessage — no agent configured', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendText.mockReset();
    mockOpenAiCreate.mockReset();
    setupDefaultDbResponses();
    mockGetAgentConfig.mockImplementation(() => Promise.resolve(null));
  });

  // Restore default getAgentConfig after each test in this suite
  // (using a local afterEach-style via mockImplementation at end)
  it('should return early without calling OpenAI or sendText', async () => {
    await handleIncomingMessage(TEST_IDS.CONV_A, 'test-instance', 'Hola');

    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();

    // Restore default so subsequent describe blocks still get an agent
    mockGetAgentConfig.mockImplementation(() =>
      Promise.resolve({ agent: makeAgent(), sections: [], tools: [], variables: [] }),
    );
  });
});

// ---------------------------------------------------------------------------
// Note: conversation-level serialization now lives in webhook.ts (webhookLocks).
// The locking test has moved to evolution/__tests__/webhook.test.ts.
// ---------------------------------------------------------------------------
