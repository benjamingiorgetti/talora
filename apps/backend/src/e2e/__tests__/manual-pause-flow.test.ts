// @ts-nocheck
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';

const COMPANY_ID = '0ebff45a-49d3-4aa4-a287-baaab9a732bf';
const CONVERSATION_ID = '62d66c88-2120-491f-ade9-26a5ff34ad40';
const INSTANCE_ID = '8fa68196-e74a-47f6-8e4c-dc2e1318a985';
const INSTANCE_NAME = 'test-instance';
const PHONE = '5491166101401';
const FIXED_NOW = '2026-03-17T13:00:00.000Z';
const AUTO_RESUME_AT = '2026-03-17T13:30:00.000Z';

const mockQuery = mock(async () => ({ rows: [], rowCount: 0 }));
const mockSendText = mock(() => Promise.resolve({ key: { id: 'evo-msg-1' } }));
const mockHandleIncomingMessage = mock(() => Promise.resolve());
const mockArchiveStaleConversations = mock(() => Promise.resolve());

const state = {
  conversation: {
    id: CONVERSATION_ID,
    company_id: COMPANY_ID,
    instance_id: INSTANCE_ID,
    phone_number: PHONE,
    contact_name: 'Benjamin',
    professional_id: null,
    professional_binding_suppressed: true,
    bot_paused: false,
    auto_resume_at: null,
    paused_at: null,
    paused_by_user_id: null,
    archived_at: null,
    archive_reason: null,
    memory_reset_at: FIXED_NOW,
    last_message_at: FIXED_NOW,
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
  },
  pauseRow: null as null | {
    conversation_id: string;
    paused_at: string;
    auto_resume_at: string | null;
    pause_source: string;
    resumed_at: string | null;
  },
  messages: [] as Array<{ role: string; content: string | null }>,
};

mock.module('../../db/pool', () => ({
  pool: {
    query: mockQuery,
  },
}));

mock.module('../../config', () => ({
  config: {
    nodeEnv: 'test',
    webhookSecret: '',
    webhookAllowedHosts: '',
    evolutionApiUrl: 'http://localhost:8080',
    evolutionApiKey: 'test-key',
    messageBufferDelayMs: 10,
    messageBufferMaxWindowMs: 10,
  },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  },
}));

mock.module('../../utils/timeout', () => ({
  withTimeout: mock(<T>(promise: Promise<T>) => promise),
}));

mock.module('../../ws/server', () => ({
  broadcast: mock(() => {}),
}));

mock.module('../../agent/index', () => ({
  handleIncomingMessage: mockHandleIncomingMessage,
}));

mock.module('../../conversations/archive', () => ({
  archiveStaleConversations: mockArchiveStaleConversations,
  isConversationInactive: mock(() => false),
}));

mock.module('../../conversations/reset', () => ({
  isResetCommand: mock(() => false),
  resetConversationMemory: mock(() => Promise.resolve()),
}));

mock.module('../../agent/transcribe', () => ({
  transcribeAudio: mock(() => Promise.resolve('hola')),
}));

mock.module('../../evolution/client', () => ({
  EvolutionClient: class MockEvolutionClient {
    sendText = mockSendText;
    sendReaction = mock(() => Promise.resolve({}));
    getInstanceInfo = mock(() => Promise.resolve({ ownerJid: `${PHONE}@s.whatsapp.net` }));
  },
  EvolutionApiError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

let currentUser = {
  userId: 'user-admin-a',
  email: 'admin-a@test.com',
  fullName: 'Admin',
  role: 'admin_empresa',
  companyId: COMPANY_ID,
};

mock.module('../../api/middleware', () => ({
  authMiddleware: mock((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { ...currentUser };
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  getRequestCompanyId: mock((req: express.Request) => req.user?.companyId ?? null),
  getRequestProfessionalId: mock(() => null),
}));

const { conversationsRouter } = await import('../../api/conversations');
const { handleMessagesUpsert } = await import('../../evolution/webhook');

const app = express();
app.use(express.json());
app.use('/conversations', conversationsRouter);

let server: Server;
let baseUrl: string;

beforeAll(() => {
  server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  state.conversation = {
    id: CONVERSATION_ID,
    company_id: COMPANY_ID,
    instance_id: INSTANCE_ID,
    phone_number: PHONE,
    contact_name: 'Benjamin',
    professional_id: null,
    professional_binding_suppressed: true,
    bot_paused: false,
    auto_resume_at: null,
    paused_at: null,
    paused_by_user_id: null,
    archived_at: null,
    archive_reason: null,
    memory_reset_at: FIXED_NOW,
    last_message_at: FIXED_NOW,
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
  };
  state.pauseRow = null;
  state.messages = [];
  mockHandleIncomingMessage.mockReset();
  mockSendText.mockReset();
  mockSendText.mockImplementation(() => Promise.resolve({ key: { id: 'evo-msg-1' } }));

  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: unknown, params: unknown[] = []) => {
    const s = String(sql);

    if (s.includes('SELECT c.*, wi.evolution_instance_name')) {
      return {
        rows: [{ ...state.conversation, evolution_instance_name: INSTANCE_NAME, instance_status: 'connected' }],
        rowCount: 1,
      };
    }

    if (s.includes('SET bot_paused = true') && s.includes("auto_resume_at = NOW() + INTERVAL '30 minutes'")) {
      state.conversation = {
        ...state.conversation,
        bot_paused: true,
        auto_resume_at: AUTO_RESUME_AT,
        paused_at: FIXED_NOW,
        paused_by_user_id: String(params[0]),
      };
      return { rows: [{ ...state.conversation }], rowCount: 1 };
    }

    if (s.includes('INSERT INTO conversation_pauses')) {
      state.pauseRow = {
        conversation_id: CONVERSATION_ID,
        paused_at: FIXED_NOW,
        auto_resume_at: AUTO_RESUME_AT,
        pause_source: 'manual_message',
        resumed_at: null,
      };
      return { rows: [], rowCount: 1 };
    }

    if (s.includes(`VALUES ($1, 'assistant', $2)`)) {
      state.messages.push({ role: 'assistant', content: String(params[1]) });
      return { rows: [{ id: 'assistant-msg-1', conversation_id: CONVERSATION_ID, role: 'assistant', content: params[1] }], rowCount: 1 };
    }

    if (s.includes(`VALUES ($1, 'user', $2)`)) {
      state.messages.push({ role: 'user', content: String(params[1]) });
      return { rows: [{ id: 'user-msg-1', created_at: FIXED_NOW }], rowCount: 1 };
    }

    if (s.includes('UPDATE conversations SET last_message_at = NOW()')) {
      state.conversation = {
        ...state.conversation,
        last_message_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      };
      return { rows: [], rowCount: 1 };
    }

    if (s.includes('whatsapp_instances WHERE evolution_instance_name')) {
      return {
        rows: [{
          id: INSTANCE_ID,
          company_id: COMPANY_ID,
          evolution_instance_name: INSTANCE_NAME,
          status: 'connected',
          qr_code: null,
          phone_number: PHONE,
        }],
        rowCount: 1,
      };
    }

    if (s.includes('FROM clients')) {
      return { rows: [], rowCount: 0 };
    }

    if (s.includes('FROM conversations') && s.includes('instance_id = $1 AND phone_number = $2')) {
      return {
        rows: [{ id: CONVERSATION_ID, archived_at: null, last_message_at: state.conversation.last_message_at }],
        rowCount: 1,
      };
    }

    if (s.includes('INSERT INTO conversations')) {
      state.conversation = {
        ...state.conversation,
        last_message_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      };
      return { rows: [{ ...state.conversation }], rowCount: 1 };
    }

    if (s.includes('SELECT bot_paused, auto_resume_at FROM conversations WHERE id = $1')) {
      return {
        rows: [{ bot_paused: state.conversation.bot_paused, auto_resume_at: state.conversation.auto_resume_at }],
        rowCount: 1,
      };
    }

    if (s.includes('UPDATE conversations') && s.includes('auto_resume_at IS NOT NULL')) {
      return { rows: [], rowCount: 0 };
    }

    if (s.includes('UPDATE conversation_pauses')) {
      return { rows: [], rowCount: state.pauseRow ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  });
});

describe('manual send pause flow', () => {
  it('persists the manual pause and prevents the webhook from invoking the bot on the next client message', async () => {
    const manualRes = await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'banca' }),
    });

    expect(manualRes.status).toBe(201);
    expect(state.conversation.bot_paused).toBe(true);
    expect(state.conversation.auto_resume_at).toBe(AUTO_RESUME_AT);
    expect(state.pauseRow?.pause_source).toBe('manual_message');

    await handleMessagesUpsert({
      event: 'messages.upsert',
      instance: INSTANCE_NAME,
      data: {
        key: {
          id: 'incoming-1',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
        },
        message: {
          conversation: 'que onda',
        },
        pushName: 'Benjamin',
      },
    });

    expect(state.messages.some((message) => message.role === 'user' && message.content === 'que onda')).toBe(true);
    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();
    expect(state.conversation.bot_paused).toBe(true);
    expect(state.conversation.auto_resume_at).toBe(AUTO_RESUME_AT);
  });

  it('prevents a buffered agent reply from leaking through while a manual send is in flight', async () => {
    mockSendText.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ key: { id: 'evo-msg-slow' } }), 25)),
    );

    await handleMessagesUpsert({
      event: 'messages.upsert',
      instance: INSTANCE_NAME,
      data: {
        key: {
          id: 'incoming-buffered-1',
          remoteJid: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
        },
        message: {
          conversation: 'que onda',
        },
        pushName: 'Benjamin',
      },
    });

    const manualResPromise = fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hola loco' }),
    });

    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(mockHandleIncomingMessage).not.toHaveBeenCalled();

    const manualRes = await manualResPromise;
    expect(manualRes.status).toBe(201);
    expect(state.conversation.bot_paused).toBe(true);
    expect(state.conversation.auto_resume_at).toBe(AUTO_RESUME_AT);
  });
});
