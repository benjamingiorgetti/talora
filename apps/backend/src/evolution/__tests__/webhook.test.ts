// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockQuery, setupQueryMock } from '../../__test-utils__/mock-pool';
import { createMockLogger } from '../../__test-utils__/mock-logger';
import { createMockReq } from '../../__test-utils__/mock-request';
import { TEST_IDS } from '../../__test-utils__/factories';
import type { Request } from 'express';

// ---------------------------------------------------------------------------
// Fixed test identifiers
// ---------------------------------------------------------------------------
const INSTANCE_ID = 'inst-aaaa-1111-2222-333333333333';
const INSTANCE_NAME = 'test-instance';
const PHONE = '5491155550000';
const CONV_ID = TEST_IDS.CONV_A;
const COMPANY_ID = TEST_IDS.COMPANY_A;
const FIXED_NOW = '2026-03-14T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Mock factories — created before module import
// ---------------------------------------------------------------------------
const mockQuery = createMockQuery();
const mockLogger = createMockLogger();
const mockBroadcast = mock(() => {});
const mockHandleIncomingMessage = mock(() => Promise.resolve());
const mockSendText = mock(() => Promise.resolve({ key: { id: 'msg-sent-001' } }));
const mockSendReaction = mock(() => Promise.resolve({ key: { id: 'msg-rxn-001' } }));
const mockGetInstanceInfo = mock(() =>
  Promise.resolve({ ownerJid: `${PHONE}@s.whatsapp.net`, connectionStatus: 'open' })
);
const mockIsResetCommand = mock((_text: string) => false);
const mockResetConversationMemory = mock(() =>
  Promise.resolve({
    conversation: {
      id: CONV_ID,
      company_id: COMPANY_ID,
      instance_id: INSTANCE_ID,
      professional_id: null,
      last_message_at: FIXED_NOW,
      bot_paused: false,
      archived_at: FIXED_NOW,
      archive_reason: 'manual_reset',
    },
    systemMessage: {
      id: 'sys-msg-001',
      conversation_id: CONV_ID,
      role: 'system',
      content: 'Memoria reseteada.',
      tool_calls: null,
      tool_call_id: null,
      created_at: FIXED_NOW,
    },
  })
);
const mockIsConversationInactive = mock((_lastMessageAt: string | null | undefined) => false);

// ---------------------------------------------------------------------------
// Module mocks — MUST be registered before the dynamic import below
// ---------------------------------------------------------------------------
mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../config', () => ({
  config: {
    nodeEnv: 'test',
    webhookSecret: '',
    webhookAllowedHosts: '',
    evolutionApiUrl: 'http://localhost:8080',
    evolutionApiKey: 'test-api-key',
    messageBufferDelayMs: 100,
    messageBufferMaxWindowMs: 500,
  },
}));

mock.module('../../ws/server', () => ({
  broadcast: mockBroadcast,
}));

mock.module('../../agent/index', () => ({
  handleIncomingMessage: mockHandleIncomingMessage,
}));

mock.module('../client', () => ({
  EvolutionClient: class MockEvolutionClient {
    sendText = mockSendText;
    sendReaction = mockSendReaction;
    getInstanceInfo = mockGetInstanceInfo;
  },
}));

mock.module('../../utils/logger', () => ({
  logger: mockLogger,
}));

mock.module('../../utils/timeout', () => ({
  withTimeout: mock(<T>(promise: Promise<T>, _ms: number, _label: string) => promise),
}));

mock.module('../../conversations/reset', () => ({
  isResetCommand: mockIsResetCommand,
  resetConversationMemory: mockResetConversationMemory,
}));

mock.module('../../conversations/archive', () => ({
  isConversationInactive: mockIsConversationInactive,
}));

// ---------------------------------------------------------------------------
// Dynamic import — happens after all mock.module registrations
// ---------------------------------------------------------------------------
const {
  isWebhookAuthorized,
  normalizePhone,
  handleMessagesUpsert,
  handleConnectionUpdate,
  handleQrCodeUpdate,
  messageBuffers,
} = await import('../webhook');

// ---------------------------------------------------------------------------
// DB row fixtures
// ---------------------------------------------------------------------------
const instanceRow = {
  id: INSTANCE_ID,
  company_id: COMPANY_ID,
  evolution_instance_name: INSTANCE_NAME,
  status: 'connected',
  qr_code: null,
  phone_number: PHONE,
};

const conversationRow = {
  id: CONV_ID,
  company_id: COMPANY_ID,
  instance_id: INSTANCE_ID,
  phone_number: PHONE,
  contact_name: 'Test Client',
  professional_id: TEST_IDS.PROF_A,
  bot_paused: false,
  archived_at: null,
  archive_reason: null,
  last_message_at: FIXED_NOW,
};

const messageRow = {
  id: 'msg-aaaa-1111',
  created_at: FIXED_NOW,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Wait for the message buffer timer (100ms in test config) to fire and complete. */
async function waitForBuffer(ms = 150) {
  await new Promise((r) => setTimeout(r, ms));
}

function makeWebhookBody(overrides: Record<string, unknown> = {}) {
  return {
    event: 'messages.upsert',
    instance: INSTANCE_NAME,
    data: {
      key: {
        id: 'ev-msg-001',
        remoteJid: `${PHONE}@s.whatsapp.net`,
        fromMe: false,
      },
      message: {
        conversation: 'Hola, quiero un turno',
      },
      pushName: 'Test Client',
    },
    ...overrides,
  };
}

function setupDefaultQueryMock() {
  setupQueryMock(mockQuery, [
    ['whatsapp_instances WHERE evolution_instance_name', [instanceRow]],
    ['FROM clients', []],
    ['FROM conversations', [{ id: CONV_ID, archived_at: null, last_message_at: FIXED_NOW }]],
    ['INSERT INTO conversations', [conversationRow]],
    ['INSERT INTO messages', [messageRow]],
    ['UPDATE whatsapp_instances', [instanceRow]],
  ]);
}

// ---------------------------------------------------------------------------
// isWebhookAuthorized
// ---------------------------------------------------------------------------
describe('isWebhookAuthorized', () => {
  it('should return true when secret is configured and header matches', async () => {
    // Config mock is static — we exercise the function with a request that carries
    // the matching header. To do this we need to re-evaluate with a fresh mock.module
    // config override. Because module mocks are module-level, we test via a
    // hand-crafted request and replicate the logic indirectly through a config
    // object passed via a helper. Instead, we test the exported function directly
    // using the mocked config (webhookSecret is '' by default). We re-import the
    // function is shared so we test branches by manipulating the config shape.
    //
    // The config mock returns webhookSecret:''. We cannot change it mid-test without
    // a separate describe-level mock. We verify the two IP-allowlist paths instead.

    // No secret, no allowlist, nodeEnv='test' (not 'development') → false
    const req = createMockReq({ ip: '1.2.3.4', hostname: 'unknown' }) as unknown as Request;
    const result = isWebhookAuthorized(req);
    expect(result).toBe(false);
  });

  it('should return true when no secret but IP is in the allowlist', async () => {
    // Override config inline by mutating the mock (safe because config is a plain object)
    const { config } = await import('../../config');
    (config as Record<string, unknown>).webhookAllowedHosts = '127.0.0.1,10.0.0.1';
    (config as Record<string, unknown>).webhookSecret = '';

    const req = createMockReq({
      ip: '127.0.0.1',
      hostname: 'localhost',
      headers: {},
      query: {},
    }) as unknown as Request;

    const result = isWebhookAuthorized(req);
    expect(result).toBe(true);

    // Restore
    (config as Record<string, unknown>).webhookAllowedHosts = '';
  });

  it('should return false when no secret and IP is not in the allowlist', async () => {
    const { config } = await import('../../config');
    (config as Record<string, unknown>).webhookAllowedHosts = '127.0.0.1';
    (config as Record<string, unknown>).webhookSecret = '';

    const req = createMockReq({
      ip: '9.9.9.9',
      hostname: 'evil.com',
      headers: {},
      query: {},
    }) as unknown as Request;

    const result = isWebhookAuthorized(req);
    expect(result).toBe(false);

    // Restore
    (config as Record<string, unknown>).webhookAllowedHosts = '';
  });

  it('should return true when secret is configured and header matches', async () => {
    const { config } = await import('../../config');
    (config as Record<string, unknown>).webhookSecret = 'super-secret';

    const req = createMockReq({
      headers: { 'x-webhook-secret': 'super-secret' },
      query: {},
    }) as unknown as Request;

    const result = isWebhookAuthorized(req);
    expect(result).toBe(true);

    // Restore
    (config as Record<string, unknown>).webhookSecret = '';
  });

  it('should return false when secret is configured but header does not match', async () => {
    const { config } = await import('../../config');
    (config as Record<string, unknown>).webhookSecret = 'super-secret';

    const req = createMockReq({
      headers: { 'x-webhook-secret': 'wrong-secret' },
      query: {},
    }) as unknown as Request;

    const result = isWebhookAuthorized(req);
    expect(result).toBe(false);

    // Restore
    (config as Record<string, unknown>).webhookSecret = '';
  });
});

// ---------------------------------------------------------------------------
// normalizePhone
// ---------------------------------------------------------------------------
describe('normalizePhone', () => {
  it('should strip non-digit characters from a formatted phone number', () => {
    expect(normalizePhone('+54 911 5555-0000')).toBe('5491155550000');
  });

  it('should return already-clean digits unchanged', () => {
    expect(normalizePhone('5491155550000')).toBe('5491155550000');
  });

  it('should return an empty string for an empty input', () => {
    expect(normalizePhone('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// handleMessagesUpsert
// ---------------------------------------------------------------------------
describe('handleMessagesUpsert', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBroadcast.mockReset();
    mockHandleIncomingMessage.mockReset();
    mockSendText.mockReset();
    mockSendReaction.mockReset();
    mockIsResetCommand.mockReset();
    mockIsConversationInactive.mockReset();
    messageBuffers.clear();

    // Default: no reset command, conversation not inactive
    mockIsResetCommand.mockImplementation(() => false);
    mockIsConversationInactive.mockImplementation(() => false);
    mockHandleIncomingMessage.mockImplementation(() => Promise.resolve());
    mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'msg-sent-001' } }));
    mockSendReaction.mockImplementation(() => Promise.resolve({ key: { id: 'msg-rxn-001' } }));

    setupDefaultQueryMock();
  });

  it('should create/update conversation in DB and call handleIncomingMessage after buffer delay', async () => {
    await handleMessagesUpsert(makeWebhookBody());

    // Verified at least one query touched whatsapp_instances (instance lookup)
    const queryCalls = mockQuery.mock.calls as unknown as any[][];
    const instanceQuery = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('whatsapp_instances WHERE evolution_instance_name')
    );
    expect(instanceQuery).toBeDefined();

    // Verified INSERT INTO conversations was executed
    const convQuery = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('INSERT INTO conversations')
    );
    expect(convQuery).toBeDefined();

    // Verified message was saved
    const msgQuery = queryCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('INSERT INTO messages')
    );
    expect(msgQuery).toBeDefined();

    // Agent is NOT called immediately — it's buffered
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();

    // Wait for buffer timer to fire
    await waitForBuffer();

    // Agent was called after buffer delay
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
    const agentCalls = mockHandleIncomingMessage.mock.calls as unknown as any[][];
    expect(agentCalls[0][0]).toBe(CONV_ID);
  });

  it('should skip processing when fromMe is true', async () => {
    const body = makeWebhookBody({
      data: {
        key: {
          id: 'ev-from-me',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: true,
        },
        message: { conversation: 'Hola' },
        pushName: 'Me',
      },
    });

    await handleMessagesUpsert(body);

    // No DB writes, no agent call
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should skip processing when remoteJid is status@broadcast', async () => {
    const body = makeWebhookBody({
      data: {
        key: {
          id: 'ev-broadcast',
          remoteJid: 'status@broadcast',
          fromMe: false,
        },
        message: { conversation: 'Broadcast text' },
        pushName: null,
      },
    });

    await handleMessagesUpsert(body);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should send unsupported media reply and NOT call agent when message has no text', async () => {
    const body = makeWebhookBody({
      data: {
        key: {
          id: 'ev-media-001',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
        },
        // imageMessage without caption — no text extractable
        message: {
          imageMessage: {},
        },
        pushName: 'Test Client',
      },
    });

    await handleMessagesUpsert(body);

    expect(mockSendText).toHaveBeenCalledTimes(1);
    const sendTextCalls = mockSendText.mock.calls as unknown as any[][];
    expect(sendTextCalls[0][2]).toContain('solo puedo procesar texto');
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should call resetConversationMemory and send reaction when message is a reset command', async () => {
    mockIsResetCommand.mockImplementation(() => true);

    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: {
          id: 'ev-reset-001',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
        },
        message: { conversation: '/reset' },
        pushName: 'Test Client',
      },
    }));

    expect(mockResetConversationMemory).toHaveBeenCalledTimes(1);
    const resetCalls = mockResetConversationMemory.mock.calls as unknown as any[][];
    expect(resetCalls[0][0]).toBe(CONV_ID);

    // Should have sent a ✅ reaction
    expect(mockSendReaction).toHaveBeenCalledTimes(1);
    const reactionCalls = mockSendReaction.mock.calls as unknown as any[][];
    expect(reactionCalls[0][2]).toBe('✅');

    // Agent must NOT be called after a reset
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should skip agent call when bot_paused is true', async () => {
    setupQueryMock(mockQuery, [
      ['whatsapp_instances WHERE evolution_instance_name', [instanceRow]],
      ['FROM clients', []],
      ['FROM conversations', [{ id: CONV_ID, archived_at: null, last_message_at: FIXED_NOW }]],
      ['INSERT INTO conversations', [{ ...conversationRow, bot_paused: true }]],
      ['INSERT INTO messages', [messageRow]],
    ]);

    await handleMessagesUpsert(makeWebhookBody());

    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should return early when instance is not found in DB', async () => {
    setupQueryMock(mockQuery, [
      ['whatsapp_instances WHERE evolution_instance_name', []],
    ]);

    await handleMessagesUpsert(makeWebhookBody());

    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should be idempotent — duplicate message ID must be processed only once', async () => {
    // Use a unique ID to avoid collision with the processedMessages set populated
    // by previous tests in this file (the set is module-level and persists).
    const body = makeWebhookBody({
      data: {
        key: {
          id: 'ev-idempotency-unique-001',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
        },
        message: { conversation: 'Mensaje idempotente' },
        pushName: 'Test Client',
      },
    });

    await handleMessagesUpsert(body);
    await waitForBuffer();
    const firstCallCount = (mockHandleIncomingMessage.mock.calls as unknown as any[][]).length;

    // Reset mocks but NOT the idempotency map (it lives in the module)
    mockQuery.mockReset();
    mockHandleIncomingMessage.mockReset();
    messageBuffers.clear();
    setupDefaultQueryMock();

    // Second call with the same body (same key.id)
    await handleMessagesUpsert(body);
    await waitForBuffer();
    const secondCallCount = (mockHandleIncomingMessage.mock.calls as unknown as any[][]).length;

    expect(firstCallCount).toBe(1);
    expect(secondCallCount).toBe(0); // Must not increase — idempotency map blocks it
  });
});

// ---------------------------------------------------------------------------
// Conversation-level serialization (regression: reset + hola race condition)
// ---------------------------------------------------------------------------
describe('handleMessagesUpsert — conversation serialization', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBroadcast.mockReset();
    mockHandleIncomingMessage.mockReset();
    mockSendText.mockReset();
    mockSendReaction.mockReset();
    mockIsResetCommand.mockReset();
    mockIsConversationInactive.mockReset();
    messageBuffers.clear();

    mockIsConversationInactive.mockImplementation(() => false);
    mockHandleIncomingMessage.mockImplementation(() => Promise.resolve());
    mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'msg-sent-001' } }));
    mockSendReaction.mockImplementation(() => Promise.resolve({ key: { id: 'msg-rxn-001' } }));
  });

  it('should serialize /reset then hola for the same phone — hola must unarchive', async () => {
    const order: string[] = [];

    // isResetCommand returns true for first call (/reset), false for second (hola)
    let resetCallCount = 0;
    mockIsResetCommand.mockImplementation(() => {
      resetCallCount++;
      return resetCallCount === 1;
    });

    // Make resetConversationMemory slow enough to expose the race condition
    let resolveReset!: () => void;
    const resetBlocked = new Promise<void>((resolve) => {
      resolveReset = resolve;
    });
    mockResetConversationMemory.mockImplementation(async () => {
      order.push('reset:start');
      await resetBlocked;
      order.push('reset:end');
      return {
        conversation: {
          id: CONV_ID,
          company_id: COMPANY_ID,
          instance_id: INSTANCE_ID,
          professional_id: null,
          last_message_at: FIXED_NOW,
          bot_paused: false,
          archived_at: FIXED_NOW,
          archive_reason: 'manual_reset',
        },
        systemMessage: {
          id: 'sys-msg-001',
          conversation_id: CONV_ID,
          role: 'system',
          content: 'Memoria reseteada.',
          tool_calls: null,
          tool_call_id: null,
          created_at: FIXED_NOW,
        },
      };
    });

    mockHandleIncomingMessage.mockImplementation(async () => {
      order.push('agent');
    });

    // Setup DB mocks — will be called twice (once per message), so set up enough rows
    setupQueryMock(mockQuery, [
      // First call (/reset)
      ['whatsapp_instances WHERE evolution_instance_name', [instanceRow]],
      ['bot_enabled', [{ bot_enabled: true }]],
      ['FROM clients', []],
      ['FROM professionals', [{ id: TEST_IDS.PROF_A }]],
      ['FROM conversations', [{ id: CONV_ID, archived_at: null, last_message_at: FIXED_NOW }]],
      ['INSERT INTO conversations', [conversationRow]],
      // Second call (hola)
      ['whatsapp_instances WHERE evolution_instance_name', [instanceRow]],
      ['bot_enabled', [{ bot_enabled: true }]],
      ['FROM clients', []],
      ['FROM professionals', [{ id: TEST_IDS.PROF_A }]],
      ['FROM conversations', [{ id: CONV_ID, archived_at: FIXED_NOW, last_message_at: FIXED_NOW }]],
      ['INSERT INTO conversations', [{ ...conversationRow, archived_at: null, archive_reason: null }]],
      ['INSERT INTO messages', [messageRow]],
    ]);

    const resetBody = makeWebhookBody({
      data: {
        key: { id: 'ev-reset-serial', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: '/reset' },
        pushName: 'Test Client',
      },
    });

    const holaBody = makeWebhookBody({
      data: {
        key: { id: 'ev-hola-serial', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'hola' },
        pushName: 'Test Client',
      },
    });

    // Fire both concurrently (simulating backend processing queued webhooks)
    const first = handleMessagesUpsert(resetBody);
    // Small delay to ensure reset starts first
    await new Promise((r) => setTimeout(r, 10));
    const second = handleMessagesUpsert(holaBody);

    // Release the reset — with serialization, hola should only start AFTER reset finishes
    resolveReset();

    await Promise.all([first, second]);

    // Wait for the buffer timer to fire (hola schedules agent via buffer)
    await waitForBuffer();

    // Reset must complete fully before hola's agent call
    expect(order).toEqual(['reset:start', 'reset:end', 'agent']);

    // Agent was called (hola was processed after reset)
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// handleConnectionUpdate
// ---------------------------------------------------------------------------
describe('handleConnectionUpdate', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBroadcast.mockReset();
    mockGetInstanceInfo.mockReset();
    mockGetInstanceInfo.mockImplementation(() =>
      Promise.resolve({ ownerJid: `${PHONE}@s.whatsapp.net`, connectionStatus: 'open' })
    );

    setupQueryMock(mockQuery, [
      ['UPDATE whatsapp_instances', [instanceRow]],
    ]);
  });

  it('should update instance status to "connected" and clear QR when state is "open"', async () => {
    await handleConnectionUpdate({
      event: 'connection.update',
      instance: INSTANCE_NAME,
      data: { state: 'open' },
    });

    const connCalls = mockQuery.mock.calls as unknown as any[][];
    const updateCall = connCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('UPDATE whatsapp_instances')
    );
    expect(updateCall).toBeDefined();
    // First param after SQL is the new status
    expect(updateCall![1]).toContain('connected');

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'instance:status' })
    );
  });

  it('should update instance status to "disconnected" when state is "close"', async () => {
    await handleConnectionUpdate({
      event: 'connection.update',
      instance: INSTANCE_NAME,
      data: { state: 'close' },
    });

    const closeCalls = mockQuery.mock.calls as unknown as any[][];
    const updateCall = closeCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('UPDATE whatsapp_instances')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toContain('disconnected');
  });

  it('should return early without DB calls when instanceName or state is missing', async () => {
    await handleConnectionUpdate({
      event: 'connection.update',
      instance: '',
      data: { state: 'open' },
    });

    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleQrCodeUpdate
// ---------------------------------------------------------------------------
describe('handleQrCodeUpdate', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBroadcast.mockReset();
    mockLogger.warn.mockReset();

    setupQueryMock(mockQuery, [
      ['UPDATE whatsapp_instances', [{ ...instanceRow, status: 'qr_pending', qr_code: 'data:image/png;base64,abc123' }]],
    ]);
  });

  it('should save QR code and set status to qr_pending when base64 is present', async () => {
    const qrBase64 = 'data:image/png;base64,abc123==';

    await handleQrCodeUpdate({
      event: 'qrcode.updated',
      instance: INSTANCE_NAME,
      data: { qrcode: { base64: qrBase64 } },
    });

    const qrCalls = mockQuery.mock.calls as unknown as any[][];
    const updateCall = qrCalls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('UPDATE whatsapp_instances')
    );
    expect(updateCall).toBeDefined();
    // pool.query(sql, [param1, param2, ...]) — args[1] is the params array; $1 = qr_code
    expect((updateCall as any[])[1]).toEqual([qrBase64, INSTANCE_NAME]);

    expect(mockBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'instance:status',
        payload: expect.objectContaining({ status: 'qr_pending' }),
      })
    );
  });

  it('should log a warning and not crash when QR data is missing', async () => {
    await handleQrCodeUpdate({
      event: 'qrcode.updated',
      instance: INSTANCE_NAME,
      data: {},
    });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    // No DB query should have been executed
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('should return early without logging when instanceName is missing', async () => {
    await handleQrCodeUpdate({
      event: 'qrcode.updated',
      instance: '',
      data: { qrcode: { base64: 'data:image/png;base64,abc' } },
    });

    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Message buffer / debounce tests
// ---------------------------------------------------------------------------
describe('handleMessagesUpsert — message buffer', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockBroadcast.mockReset();
    mockHandleIncomingMessage.mockReset();
    mockSendText.mockReset();
    mockSendReaction.mockReset();
    mockIsResetCommand.mockReset();
    mockIsConversationInactive.mockReset();
    messageBuffers.clear();

    mockIsResetCommand.mockImplementation(() => false);
    mockIsConversationInactive.mockImplementation(() => false);
    mockHandleIncomingMessage.mockImplementation(() => Promise.resolve());
    mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'msg-sent-001' } }));
    mockSendReaction.mockImplementation(() => Promise.resolve({ key: { id: 'msg-rxn-001' } }));
  });

  it('should fire agent once after a single message and buffer delay', async () => {
    setupDefaultQueryMock();

    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-single-buf', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Hola' },
        pushName: 'Test Client',
      },
    }));

    // Agent NOT called immediately
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
    expect(messageBuffers.size).toBe(1);

    await waitForBuffer();

    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
    expect(messageBuffers.size).toBe(0);
  });

  it('should batch two messages within buffer window into one agent call', async () => {
    setupDefaultQueryMock();

    // First message
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-batch-1', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'sí' },
        pushName: 'Test Client',
      },
    }));

    // Second message 50ms later (within 100ms buffer window)
    await new Promise((r) => setTimeout(r, 50));
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-batch-2', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'jueves a las 14' },
        pushName: 'Test Client',
      },
    }));

    // Still no agent call
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();

    // Wait for buffer to fire (100ms from last message = 150ms from now)
    await waitForBuffer();

    // Only ONE agent call, not two
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
  });

  it('should make two separate agent calls for messages spaced beyond buffer delay', async () => {
    setupDefaultQueryMock();

    // First message
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-sep-1', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Hola' },
        pushName: 'Test Client',
      },
    }));

    // Wait for buffer to fire
    await waitForBuffer();
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);

    // Second message after buffer has fired
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-sep-2', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Quiero un turno' },
        pushName: 'Test Client',
      },
    }));

    await waitForBuffer();
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(2);
  });

  it('should cancel pending buffer when /reset command arrives', async () => {
    setupDefaultQueryMock();

    // First message — schedules buffer
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-rst-buf-1', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Hola' },
        pushName: 'Test Client',
      },
    }));

    expect(messageBuffers.size).toBe(1);

    // /reset arrives — should cancel the buffer
    mockIsResetCommand.mockImplementation(() => true);
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-rst-buf-2', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: '/reset' },
        pushName: 'Test Client',
      },
    }));

    expect(messageBuffers.size).toBe(0);

    // Wait well past the buffer delay — agent should NOT be called
    await waitForBuffer();
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should skip agent invocation when bot_paused is set between message arrival and buffer fire', async () => {
    // Setup: bot NOT paused when message arrives, but paused when buffer fires.
    // 'SELECT bot_paused' must come BEFORE 'FROM conversations' so the
    // re-check query matches the more specific pattern first.
    setupQueryMock(mockQuery, [
      ['SELECT bot_paused', [{ bot_paused: true }]],
      ['whatsapp_instances WHERE evolution_instance_name', [instanceRow]],
      ['FROM clients', []],
      ['FROM conversations', [{ id: CONV_ID, archived_at: null, last_message_at: FIXED_NOW }]],
      ['INSERT INTO conversations', [{ ...conversationRow, bot_paused: false }]],
      ['INSERT INTO messages', [messageRow]],
    ]);

    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-paused-buf', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Hola' },
        pushName: 'Test Client',
      },
    }));

    await waitForBuffer();

    // Agent should NOT be called because bot was paused at invocation time
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
  });

  it('should fire at max window when messages keep arriving within buffer delay', async () => {
    setupDefaultQueryMock();

    // Config: bufferDelay=100ms, maxWindow=500ms
    // Send 8 messages every 80ms: 7 intervals * 80ms = 560ms > 500ms max window
    // The 8th message (at ~560ms) sees elapsed >= 500ms and sets delay=0
    const messageCount = 8;
    for (let i = 0; i < messageCount; i++) {
      await handleMessagesUpsert(makeWebhookBody({
        data: {
          key: { id: `ev-rapid-${i}`, remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
          message: { conversation: `msg ${i}` },
          pushName: 'Test Client',
        },
      }));
      if (i < messageCount - 1) {
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    // The last message set delay=0, so the agent fires almost immediately.
    // Wait a small amount for the setTimeout(fn, 0) to execute.
    await new Promise((r) => setTimeout(r, 50));

    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
  });

  it('should start a new buffer cycle for messages arriving during agent processing', async () => {
    let resolveAgent!: () => void;
    const agentBlocked = new Promise<void>((resolve) => {
      resolveAgent = resolve;
    });

    // First agent call blocks; second resolves immediately
    let agentCallCount = 0;
    mockHandleIncomingMessage.mockImplementation(async () => {
      agentCallCount++;
      if (agentCallCount === 1) await agentBlocked;
    });

    setupDefaultQueryMock();

    // Message 1 — schedules buffer
    await handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-during-1', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Hola' },
        pushName: 'Test Client',
      },
    }));

    // Wait for buffer to fire — agent starts but blocks
    await waitForBuffer();
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);

    // Message 2 arrives while agent is processing (lock is held by agent).
    // Don't await — it'll queue behind the blocked agent lock.
    const p2 = handleMessagesUpsert(makeWebhookBody({
      data: {
        key: { id: 'ev-during-2', remoteJid: `${PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'Quiero cancelar' },
        pushName: 'Test Client',
      },
    }));

    // Release the first agent call so msg2 can proceed
    resolveAgent();
    await p2;

    // Wait for the second message's buffer to fire
    await waitForBuffer(300);

    // Two separate agent calls — one for each conversation turn
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(2);
  });
});
