// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS, makeClient, makeConversation } from '../../__test-utils__/factories';

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

const mockSendText = mock(() => Promise.resolve({ key: { id: 'provider-msg-1' } }));
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

const { sendWhatsAppMessage } = await import('../service');

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_ID = TEST_IDS.CLIENT_A;

beforeEach(() => {
  mockQuery.mockReset();
  mockBroadcast.mockReset();
  mockSendText.mockReset();
  mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'provider-msg-1' } }));
  mockGetConnectedInstance.mockReset();
  mockGetConnectedInstance.mockImplementation(() =>
    Promise.resolve({ evolution_instance_name: 'test-instance' })
  );
});

describe('sendWhatsAppMessage', () => {
  it('should persist outbound_messages without querying reactivation_messages', async () => {
    const client = makeClient({ phone_number: '5491155550000' });
    const company = { name: 'Barberia Roca' };

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
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
          rows: [{ id: 'msg-new-1', conversation_id: TEST_IDS.CONV_A, role: 'assistant', content: 'Hola' }],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO outbound_messages')) {
        return Promise.resolve({ rows: [{ id: 'outbound-1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendWhatsAppMessage({
      companyId: COMPANY_ID,
      clientId: CLIENT_ID,
      purpose: 'reminder',
      sourceType: 'appointment_reminder',
      sourceId: TEST_IDS.APPT_A,
      messageText: 'Recordatorio de turno',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outboundMessageId).toBe('outbound-1');
    }

    const queriedReactivationTable = mockQuery.mock.calls.some((call) =>
      String(call[0]).includes('reactivation_messages')
    );
    expect(queriedReactivationTable).toBe(false);
  });
});
