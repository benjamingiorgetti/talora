// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS, makeClient, makeConversation } from '../../__test-utils__/factories';

// ---------------------------------------------------------------------------
// Mocks — MUST precede dynamic imports
// ---------------------------------------------------------------------------

const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const mockBroadcast = mock(() => {});
mock.module('../../ws/server', () => ({
  broadcast: mockBroadcast,
}));

const mockSendText = mock(() => Promise.resolve({}));
mock.module('../../evolution/client', () => ({
  EvolutionClient: class {
    sendText = mockSendText;
  },
}));

const mockGetConnectedInstance = mock(() =>
  Promise.resolve({ evolution_instance_name: 'test-instance' })
);
mock.module('../../evolution/helpers', () => ({
  getConnectedInstance: mockGetConnectedInstance,
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { generateReactivationMessage, sendReactivationMessage } = await import('../reactivation');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_ID = TEST_IDS.CLIENT_A;
const REACTIVATION_MSG_ID = 'react-aaa-1111-2222-333333333333';

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockBroadcast.mockReset();
  mockSendText.mockReset();
  mockSendText.mockImplementation(() => Promise.resolve({}));
  mockGetConnectedInstance.mockReset();
  mockGetConnectedInstance.mockImplementation(() =>
    Promise.resolve({ evolution_instance_name: 'test-instance' })
  );
});

// ---------------------------------------------------------------------------
// generateReactivationMessage
// ---------------------------------------------------------------------------

describe('generateReactivationMessage', () => {
  it('should generate message with default template and replaced variables', () => {
    const result = generateReactivationMessage({
      clientName: 'Juan',
      daysSinceLast: 21,
      companyName: 'Barberia Roca',
    });

    expect(result).toContain('Juan');
    expect(result).toContain('21');
    expect(result).toContain('Barberia Roca');
    expect(result).toContain('Hola');
  });

  it('should use custom template when provided', () => {
    const result = generateReactivationMessage({
      clientName: 'Maria',
      daysSinceLast: 30,
      companyName: 'Salon Bella',
      customTemplate: 'Ey {{client_name}}, volvemos a verte en {{company_name}}?',
    });

    expect(result).toBe('Ey Maria, volvemos a verte en Salon Bella?');
  });

  it('should replace professional_name with empty string when undefined', () => {
    const result = generateReactivationMessage({
      clientName: 'Pedro',
      daysSinceLast: 14,
      companyName: 'Test Co',
      customTemplate: 'Hola {{client_name}}, te atiende {{professional_name}}.',
    });

    expect(result).toBe('Hola Pedro, te atiende .');
  });

  it('should replace last_service with empty string when undefined', () => {
    const result = generateReactivationMessage({
      clientName: 'Ana',
      daysSinceLast: 10,
      companyName: 'Test Co',
      customTemplate: 'Tu ultimo servicio fue {{last_service}}.',
    });

    expect(result).toBe('Tu ultimo servicio fue .');
  });

  it('should replace professional_name when provided', () => {
    const result = generateReactivationMessage({
      clientName: 'Luis',
      daysSinceLast: 7,
      companyName: 'Test Co',
      professionalName: 'Carlos',
      customTemplate: '{{professional_name}} te espera!',
    });

    expect(result).toBe('Carlos te espera!');
  });
});

// ---------------------------------------------------------------------------
// sendReactivationMessage
// ---------------------------------------------------------------------------

describe('sendReactivationMessage', () => {
  const client = makeClient({ phone_number: '5491155550000' });
  const company = { name: 'Barberia Roca' };

  function setupHappyPath() {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      // Rate limit check
      if (s.includes('FROM reactivation_messages') && s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      // Load client
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [client], rowCount: 1 });
      }
      // Load company
      if (s.includes('FROM companies WHERE id')) {
        return Promise.resolve({ rows: [company], rowCount: 1 });
      }
      // Analytics + settings for message generation
      if (s.includes('client_analytics ca')) {
        return Promise.resolve({
          rows: [{ days_since_last: 21, reactivation_message_template: null }],
          rowCount: 1,
        });
      }
      // Existing conversation
      if (s.includes('FROM conversations WHERE') && s.includes('phone_number')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      // Instance ID lookup
      if (s.includes('FROM whatsapp_instances WHERE')) {
        return Promise.resolve({ rows: [{ id: 'inst-id' }], rowCount: 1 });
      }
      // Create conversation
      if (s.includes('INSERT INTO conversations')) {
        return Promise.resolve({
          rows: [makeConversation({ phone_number: client.phone_number })],
          rowCount: 1,
        });
      }
      // Insert message
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({
          rows: [{ id: 'msg-new-1', conversation_id: TEST_IDS.CONV_A, role: 'assistant', content: 'Hi' }],
          rowCount: 1,
        });
      }
      // Insert reactivation_messages record
      if (s.includes('INSERT INTO reactivation_messages') && s.includes("'sent'")) {
        return Promise.resolve({ rows: [{ id: REACTIVATION_MSG_ID }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  }

  it('should return 429-like error when >= 20 messages sent today', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 20 }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(429);
      expect(result.error).toContain('limit');
    }
  });

  it('should return error when no connected WhatsApp instance', async () => {
    mockGetConnectedInstance.mockImplementation(() => Promise.resolve(null));

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [client], rowCount: 1 });
      }
      if (s.includes('FROM companies WHERE id')) {
        return Promise.resolve({ rows: [company], rowCount: 1 });
      }
      // Insert failed reactivation record
      if (s.includes('INSERT INTO reactivation_messages')) {
        return Promise.resolve({ rows: [{ id: 'fail-id' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(503);
      expect(result.error).toContain('WhatsApp');
    }
  });

  it('should return error when client not found', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      // Client not found
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(404);
      expect(result.error).toContain('Client not found');
    }
  });

  it('should send successfully and create reactivation_messages record with status=sent', async () => {
    setupHappyPath();

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.reactivationId).toBe(REACTIVATION_MSG_ID);
    }
    expect(mockSendText).toHaveBeenCalledTimes(1);
  });

  it('should create failed record on Evolution API error', async () => {
    mockGetConnectedInstance.mockImplementation(() =>
      Promise.resolve({ evolution_instance_name: 'test-instance' })
    );
    mockSendText.mockImplementation(() => {
      throw new Error('Evolution API timeout');
    });

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [client], rowCount: 1 });
      }
      if (s.includes('FROM companies WHERE id')) {
        return Promise.resolve({ rows: [company], rowCount: 1 });
      }
      if (s.includes('client_analytics ca')) {
        return Promise.resolve({
          rows: [{ days_since_last: 21, reactivation_message_template: null }],
          rowCount: 1,
        });
      }
      // Insert failed record
      if (s.includes('INSERT INTO reactivation_messages') && s.includes("'failed'")) {
        return Promise.resolve({ rows: [{ id: 'fail-id' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(502);
      expect(result.error).toContain('Evolution API timeout');
    }
  });

  it('should reuse existing conversation if phone matches', async () => {
    const existingConv = makeConversation({ phone_number: client.phone_number });

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [client], rowCount: 1 });
      }
      if (s.includes('FROM companies WHERE id')) {
        return Promise.resolve({ rows: [company], rowCount: 1 });
      }
      if (s.includes('client_analytics ca')) {
        return Promise.resolve({
          rows: [{ days_since_last: 21, reactivation_message_template: null }],
          rowCount: 1,
        });
      }
      // Existing conversation found
      if (s.includes('FROM conversations WHERE') && s.includes('phone_number')) {
        return Promise.resolve({ rows: [existingConv], rowCount: 1 });
      }
      // UPDATE conversation last_message_at
      if (s.includes('UPDATE conversations SET')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      // Insert message
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({
          rows: [{ id: 'msg-1', conversation_id: existingConv.id, role: 'assistant', content: 'Hi' }],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO reactivation_messages') && s.includes("'sent'")) {
        return Promise.resolve({ rows: [{ id: REACTIVATION_MSG_ID }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(true);
    // Verify UPDATE was called instead of INSERT for conversation
    const sqlCalls = mockQuery.mock.calls.map(c => String(c[0]));
    expect(sqlCalls.some(s => s.includes('UPDATE conversations SET'))).toBe(true);
    expect(sqlCalls.some(s => s.includes('INSERT INTO conversations'))).toBe(false);
  });

  it('should create new conversation if none exists', async () => {
    setupHappyPath();

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(result.success).toBe(true);
    const sqlCalls = mockQuery.mock.calls.map(c => String(c[0]));
    expect(sqlCalls.some(s => s.includes('INSERT INTO conversations'))).toBe(true);
  });

  it('should use provided messageText instead of generating one', async () => {
    const customMessage = 'Custom message for the client';

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('CURRENT_DATE')) {
        return Promise.resolve({ rows: [{ count: 0 }], rowCount: 1 });
      }
      if (s.includes('FROM clients WHERE id')) {
        return Promise.resolve({ rows: [client], rowCount: 1 });
      }
      if (s.includes('FROM companies WHERE id')) {
        return Promise.resolve({ rows: [company], rowCount: 1 });
      }
      if (s.includes('FROM conversations WHERE') && s.includes('phone_number')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (s.includes('FROM whatsapp_instances WHERE')) {
        return Promise.resolve({ rows: [{ id: 'inst-id' }], rowCount: 1 });
      }
      if (s.includes('INSERT INTO conversations')) {
        return Promise.resolve({
          rows: [makeConversation({ phone_number: client.phone_number })],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({
          rows: [{ id: 'msg-1', content: customMessage }],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO reactivation_messages') && s.includes("'sent'")) {
        return Promise.resolve({ rows: [{ id: REACTIVATION_MSG_ID }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendReactivationMessage(COMPANY_ID, CLIENT_ID, customMessage);

    expect(result.success).toBe(true);
    // The sendText should receive the custom message
    expect(mockSendText).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendText.mock.calls[0] as unknown[];
    expect(sendArgs[2]).toBe(customMessage);
  });

  it('should broadcast conversation:updated and message:new after successful send', async () => {
    setupHappyPath();

    await sendReactivationMessage(COMPANY_ID, CLIENT_ID);

    expect(mockBroadcast).toHaveBeenCalledTimes(2);
    const types = mockBroadcast.mock.calls.map(c => (c[0] as { type: string }).type);
    expect(types).toContain('conversation:updated');
    expect(types).toContain('message:new');
  });
});
