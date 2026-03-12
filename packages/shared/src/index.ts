// Shared types for Talora monorepo

// --- Auth / Multi-company ---
export type Role = 'superadmin' | 'admin_empresa' | 'professional';

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string;
  whatsapp_number: string | null;
  calendar_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  company_id: string | null;
  professional_id?: string | null;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  company_id: string | null;
  professional_id?: string | null;
  company_name?: string | null;
  impersonated_by?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  company: Company | null;
}

// --- WhatsApp Instances ---
export interface WhatsAppInstance {
  id: string;
  company_id: string;
  name: string;
  evolution_instance_name: string;
  phone_number: string | null;
  status: 'connected' | 'disconnected' | 'qr_pending';
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

// --- Agents ---
export interface Agent {
  id: string;
  company_id: string;
  name: string;
  model: string;
  system_prompt: string;
  created_at: string;
  updated_at?: string;
}

// --- Prompt Sections ---
export interface PromptSection {
  id: string;
  agent_id: string;
  title: string;
  content: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// --- Tools ---
export interface AgentTool {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// --- Professionals / Services ---
export interface Professional {
  id: string;
  company_id: string;
  name: string;
  calendar_id: string;
  specialty?: string | null;
  color_hex: string | null;
  is_active: boolean;
  user_id?: string | null;
  user_email?: string | null;
  user_full_name?: string | null;
  user_is_active?: boolean | null;
  has_login?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  company_id: string;
  professional_id?: string | null;
  name: string;
  duration_minutes: number;
  price_label: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Conversations ---
export interface Conversation {
  id: string;
  company_id: string;
  instance_id: string;
  professional_id?: string | null;
  phone_number: string;
  contact_name: string | null;
  bot_paused: boolean;
  last_message_at: string | null;
  memory_reset_at: string | null;
  created_at: string;
  updated_at?: string;
}

// --- Messages ---
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls: Record<string, unknown>[] | null;
  tool_call_id: string | null;
  created_at: string;
}

// --- Alerts ---
export interface Alert {
  id: string;
  company_id: string;
  type: string;
  message: string;
  instance_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

// --- Variables ---
export interface Variable {
  id: string;
  agent_id: string;
  key: string;
  default_value: string;
  description: string;
  category: 'system' | 'custom';
  created_at: string;
  updated_at?: string;
}

// --- Appointments ---
export interface Appointment {
  id: string;
  company_id: string;
  client_id: string | null;
  professional_id: string | null;
  service_id: string | null;
  conversation_id: string | null;
  phone_number: string;
  client_name: string;
  google_event_id: string | null;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  source: 'bot' | 'manual' | 'google_calendar';
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationPauseState {
  conversation_id: string;
  paused: boolean;
  paused_at: string | null;
  paused_by_user_id: string | null;
}

export interface DashboardMetrics {
  confirmed_appointments: number;
  automation_rate: number;
  confirmation_rate: number;
  estimated_time_saved_minutes: number;
}

// --- Test Sessions ---
export interface TestSession {
  id: string;
  agent_id: string;
  created_at: string;
  expires_at: string;
}

// --- Test Messages ---
export interface TestMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls: Record<string, unknown>[] | null;
  tool_call_id: string | null;
  created_at: string;
}

// --- Clients ---
export interface Client {
  id: string;
  company_id: string;
  agent_id: string;
  professional_id?: string | null;
  phone_number: string;
  name: string;
  client_type: string;
  branch: string;
  delivery_days: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
  next_appointment_at?: string | null;
  recent_appointments?: Array<Pick<Appointment, 'id' | 'starts_at' | 'status'>>;
  created_at: string;
  updated_at?: string;
}

// --- Bot Config ---
export interface BotConfig {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

// --- API Responses ---
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// --- WebSocket Events ---
export type WsEvent =
  | { type: 'instance:status'; payload: { id: string; status: WhatsAppInstance['status']; qr_code: string | null; phone_number: string | null; company_id?: string } }
  | { type: 'alert:new'; payload: Alert }
  | { type: 'conversation:updated'; payload: Pick<Conversation, 'id' | 'company_id' | 'instance_id' | 'professional_id' | 'last_message_at' | 'bot_paused'> }
  | { type: 'message:new'; payload: Message & { company_id?: string } };
