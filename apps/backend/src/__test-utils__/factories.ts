const COMPANY_A_ID = 'company-aaa-1111-2222-333333333333';
const COMPANY_B_ID = 'company-bbb-1111-2222-333333333333';
const PROF_A_ID = 'prof-aaaa-1111-2222-333333333333';
const PROF_B_ID = 'prof-bbbb-1111-2222-333333333333';
const SERVICE_A_ID = 'svc-aaaaa-1111-2222-333333333333';
const AGENT_A_ID = 'agent-aaa-1111-2222-333333333333';
const CONV_A_ID = 'conv-aaaa-1111-2222-333333333333';
const CLIENT_A_ID = 'client-aa-1111-2222-333333333333';
const APPT_A_ID = 'appt-aaaa-1111-2222-333333333333';

export const TEST_IDS = {
  COMPANY_A: COMPANY_A_ID,
  COMPANY_B: COMPANY_B_ID,
  PROF_A: PROF_A_ID,
  PROF_B: PROF_B_ID,
  SERVICE_A: SERVICE_A_ID,
  AGENT_A: AGENT_A_ID,
  CONV_A: CONV_A_ID,
  CLIENT_A: CLIENT_A_ID,
  APPT_A: APPT_A_ID,
} as const;

const FIXED_NOW = '2026-03-14T12:00:00.000Z';

export function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPANY_A_ID,
    name: 'Test Company',
    slug: 'test-company',
    industry: 'barberia',
    is_active: true,
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id: PROF_A_ID,
    company_id: COMPANY_A_ID,
    name: 'Professional Test',
    specialty: 'General',
    calendar_id: 'cal-test@group.calendar.google.com',
    is_active: true,
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeService(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICE_A_ID,
    company_id: COMPANY_A_ID,
    name: 'Corte de pelo',
    duration_minutes: 30,
    price: 5000,
    aliases: [],
    is_active: true,
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: APPT_A_ID,
    company_id: COMPANY_A_ID,
    professional_id: PROF_A_ID,
    client_id: CLIENT_A_ID,
    service_id: SERVICE_A_ID,
    google_event_id: 'gcal-evt-test-1',
    title: 'Corte de pelo',
    starts_at: '2026-03-15T10:00:00.000Z',
    ends_at: '2026-03-15T10:30:00.000Z',
    status: 'confirmed',
    notes: '',
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_A_ID,
    company_id: COMPANY_A_ID,
    instance_name: 'test-instance',
    remote_jid: '5491155550000@s.whatsapp.net',
    contact_name: 'Test Client',
    phone_number: '5491155550000',
    professional_id: PROF_A_ID,
    status: 'open',
    is_bot_active: true,
    last_message_at: FIXED_NOW,
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-aaaa-1111-2222-333333333333',
    conversation_id: CONV_A_ID,
    role: 'user' as const,
    content: 'Hola, quiero un turno',
    tool_calls: null,
    tool_call_id: null,
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_A_ID,
    company_id: COMPANY_A_ID,
    agent_id: AGENT_A_ID,
    professional_id: PROF_A_ID,
    name: 'Test Client',
    phone: '5491155550000',
    created_at: FIXED_NOW,
    ...overrides,
  };
}

export function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_A_ID,
    company_id: COMPANY_A_ID,
    name: 'Test Agent',
    system_prompt: 'Sos un asistente de turnos.',
    model: 'gpt-4o-mini',
    is_active: true,
    created_at: FIXED_NOW,
    ...overrides,
  };
}
