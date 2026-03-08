// Shared types for talora monorepo

// --- WhatsApp Instances ---
export interface WhatsAppInstance {
  id: string;
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

// --- Conversations ---
export interface Conversation {
  id: string;
  instance_id: string;
  phone_number: string;
  contact_name: string | null;
  last_message_at: string | null;
  created_at: string;
}

// --- Messages ---
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: Record<string, unknown>[] | null;
  tool_call_id: string | null;
  created_at: string;
}

// --- Alerts ---
export interface Alert {
  id: string;
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
  | { type: 'instance:status'; payload: Pick<WhatsAppInstance, 'id' | 'status' | 'qr_code'> }
  | { type: 'alert:new'; payload: Alert }
  | { type: 'conversation:updated'; payload: Pick<Conversation, 'id' | 'instance_id' | 'last_message_at'> }
  | { type: 'message:new'; payload: Message };
