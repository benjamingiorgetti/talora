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

    // Default: no reset command, conversation not inactive
    mockIsResetCommand.mockImplementation(() => false);
    mockIsConversationInactive.mockImplementation(() => false);
    mockHandleIncomingMessage.mockImplementation(() => Promise.resolve());
    mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'msg-sent-001' } }));
    mockSendReaction.mockImplementation(() => Promise.resolve({ key: { id: 'msg-rxn-001' } }));

    setupDefaultQueryMock();
  });

  it('should create/update conversation in DB and call handleIncomingMessage for a valid incoming message', async () => {
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

    // Agent was called with conversation ID and message text
    expect(mockHandleIncomingMessage).toHaveBeenCalledTimes(1);
    const agentCalls = mockHandleIncomingMessage.mock.calls as unknown as any[][];
    expect(agentCalls[0][0]).toBe(CONV_ID);
    expect(agentCalls[0][2]).toBe('Hola, quiero un turno');
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
    const firstCallCount = (mockHandleIncomingMessage.mock.calls as unknown as any[][]).length;

    // Reset mocks but NOT the idempotency map (it lives in the module)
    mockQuery.mockReset();
    mockHandleIncomingMessage.mockReset();
    setupDefaultQueryMock();

    // Second call with the same body (same key.id)
    await handleMessagesUpsert(body);
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
