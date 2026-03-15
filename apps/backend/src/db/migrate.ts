import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const migration = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- WhatsApp instances
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  evolution_instance_name TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt sections
CREATE TABLE IF NOT EXISTS prompt_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  "order" INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tools
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parameters JSONB NOT NULL DEFAULT '{}',
  implementation TEXT NOT NULL DEFAULT 'webhook',
  source TEXT NOT NULL DEFAULT 'custom',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  contact_name TEXT,
  professional_binding_suppressed BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_instance_phone_idx
  ON conversations(instance_id, phone_number);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);

-- Additional indices for query performance
CREATE INDEX IF NOT EXISTS prompt_sections_agent_order_idx ON prompt_sections(agent_id, "order");
CREATE INDEX IF NOT EXISTS tools_agent_idx ON tools(agent_id);
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON conversations(last_message_at DESC NULLS LAST);

-- Bot config
CREATE TABLE IF NOT EXISTS bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts(created_at DESC);

-- Seed default agent in a re-entrant way.
-- Fresh databases still have no company_id on agents at this point, while already-migrated
-- local databases do. This branch avoids failing on reruns when company_id is NOT NULL.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'company_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
    INSERT INTO agents (company_id, name, model)
    SELECT c.id, 'Illuminato Assistant', 'gpt-4o-mini'
    FROM companies c
    WHERE c.slug = 'talora-base'
      AND NOT EXISTS (
        SELECT 1
        FROM agents a
        WHERE a.company_id = c.id
      );
  ELSE
    INSERT INTO agents (name, model)
    SELECT 'Illuminato Assistant', 'gpt-4o-mini'
    WHERE NOT EXISTS (SELECT 1 FROM agents);
  END IF;
END $$;

-- Cleanup resolved alerts older than 30 days
DELETE FROM alerts WHERE resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '30 days';

-- Additional indexes for query performance
CREATE INDEX IF NOT EXISTS conversations_instance_id_idx ON conversations(instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS tools_agent_name_idx ON tools(agent_id, name);

-- Add updated_at columns where missing
ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tools ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE prompt_sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS professional_binding_suppressed BOOLEAN NOT NULL DEFAULT false;

-- Additional indexes (Issue #17)
CREATE INDEX IF NOT EXISTS idx_prompt_sections_agent_id ON prompt_sections(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_instance_id ON alerts(instance_id);
CREATE INDEX IF NOT EXISTS idx_conversations_instance_id ON conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- CHECK constraints for status/role columns (Issue #18)
DO $$ BEGIN
  ALTER TABLE whatsapp_instances ADD CONSTRAINT chk_instance_status
    CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_pending', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD CONSTRAINT chk_message_role
    CHECK (role IN ('user', 'assistant', 'system', 'tool'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update model default and existing agents
ALTER TABLE agents ALTER COLUMN model SET DEFAULT 'gpt-4o-mini';
UPDATE agents SET model = 'gpt-4o-mini' WHERE model = 'claude-opus-4-6';

-- Seed default prompt sections (fix for empty sections)
INSERT INTO prompt_sections (agent_id, title, content, "order")
SELECT a.id, 'Identidad', 'Sos el asistente virtual de un estudio de tatuajes. Fecha y hora actual: {{fechaHoraActual}}', 0
FROM agents a WHERE a.name = 'Illuminato Assistant'
  AND NOT EXISTS (SELECT 1 FROM prompt_sections WHERE agent_id = a.id)
LIMIT 1;

INSERT INTO prompt_sections (agent_id, title, content, "order")
SELECT a.id, 'Comportamiento', 'Respondé de forma amable y profesional. Usá español rioplatense. El nombre del cliente es {{nombreCliente}} y su número es {{numeroTelefono}}.', 1
FROM agents a WHERE a.name = 'Illuminato Assistant'
  AND NOT EXISTS (SELECT 1 FROM prompt_sections WHERE agent_id = a.id AND title = 'Comportamiento')
LIMIT 1;

-- Custom variables
CREATE TABLE IF NOT EXISTS variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  default_value TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS variables_agent_key_idx ON variables(agent_id, key);

-- Seed system variables
INSERT INTO variables (agent_id, key, default_value, description, category)
SELECT a.id, v.key, v.default_value, v.description, 'system'
FROM agents a, (VALUES
  ('fechaHoraActual', '', 'Fecha y hora actual del servidor'),
  ('nombreCliente', 'Cliente', 'Nombre del contacto en WhatsApp'),
  ('numeroTelefono', '', 'Numero de telefono del cliente'),
  ('horariosDisponibles', 'No disponible', 'Horarios de Google Calendar')
) AS v(key, default_value, description)
WHERE a.name = 'Illuminato Assistant'
  AND NOT EXISTS (SELECT 1 FROM variables WHERE agent_id = a.id AND key = v.key);

-- Seed baseline appointment tools for agents missing them
INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
SELECT a.id,
       'google_calendar_check',
       'Consulta disponibilidad real en Google Calendar para el servicio que el cliente quiere reservar.',
       '{"type":"object","properties":{"date":{"type":"string","description":"Fecha y hora ISO propuesta para el turno."}},"required":["date"]}'::jsonb,
       'google_calendar_check',
       'core'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.agent_id = a.id AND t.name = 'google_calendar_check'
);

INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
SELECT a.id,
       'google_calendar_book',
       'Reserva un turno real y crea el appointment interno para el cliente actual.',
       '{"type":"object","properties":{"date":{"type":"string","description":"Fecha y hora ISO del turno a reservar."}},"required":["date"]}'::jsonb,
       'google_calendar_book',
       'core'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.agent_id = a.id AND t.name = 'google_calendar_book'
);

INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
SELECT a.id,
       'google_calendar_reprogram',
       'Reprograma un turno existente a una nueva fecha y hora disponible.',
       '{"type":"object","properties":{"appointmentId":{"type":"string","description":"ID interno del turno en Talora."},"startsAt":{"type":"string","description":"Nueva fecha y hora ISO del turno."}},"required":["appointmentId","startsAt"]}'::jsonb,
       'google_calendar_reprogram',
       'core'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.agent_id = a.id AND t.name = 'google_calendar_reprogram'
);

INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
SELECT a.id,
       'google_calendar_cancel',
       'Cancela un turno existente en Google Calendar y en Talora.',
       '{"type":"object","properties":{"appointmentId":{"type":"string","description":"ID interno del turno en Talora."},"eventId":{"type":"string","description":"ID del evento en Google Calendar si ya se conoce."}}}'::jsonb,
       'google_calendar_cancel',
       'core'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.agent_id = a.id AND t.name = 'google_calendar_cancel'
);

-- Test sessions
CREATE TABLE IF NOT EXISTS test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Test messages
CREATE TABLE IF NOT EXISTS test_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS test_messages_session_idx ON test_messages(session_id, created_at);

-- Cleanup expired test sessions
DELETE FROM test_sessions WHERE expires_at < NOW();

-- Fix: add 'qr_pending' to instance status constraint (for existing DBs)
DO $$ BEGIN
  ALTER TABLE whatsapp_instances DROP CONSTRAINT IF EXISTS chk_instance_status;
  ALTER TABLE whatsapp_instances ADD CONSTRAINT chk_instance_status
    CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_pending', 'error'));
END $$;

-- Add system_prompt column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT NOT NULL DEFAULT '';

-- Add memory_reset_at for 48h per-client memory window
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS memory_reset_at TIMESTAMPTZ;

-- Migrate existing sections into system_prompt (include title as ## heading)
UPDATE agents SET system_prompt = COALESCE(
  (SELECT string_agg('## ' || ps.title || E'\n' || ps.content, E'\n\n' ORDER BY ps."order")
   FROM prompt_sections ps
   WHERE ps.agent_id = agents.id AND ps.is_active = true),
  ''
) WHERE system_prompt = '';

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  client_type TEXT NOT NULL DEFAULT 'cliente',
  branch TEXT NOT NULL DEFAULT '',
  delivery_days TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_agent_phone_idx ON clients(agent_id, phone_number);
CREATE INDEX IF NOT EXISTS clients_phone_lookup_idx ON clients(phone_number);

-- Seed new system variables (userName, phoneNumber, sessionId, idTenant, contextoCliente)
INSERT INTO variables (agent_id, key, default_value, description, category)
SELECT a.id, v.key, v.default_value, v.description, 'system'
FROM agents a, (VALUES
  ('userName', 'Cliente', 'Nombre del contacto (reemplaza nombreCliente)'),
  ('phoneNumber', '', 'Numero de telefono del cliente (reemplaza numeroTelefono)'),
  ('sessionId', '', 'ID de la conversacion actual'),
  ('idTenant', '', 'ID del agente/tenant'),
  ('contextoCliente', 'Cliente no registrado', 'Datos del cliente desde la tabla clients'),
  ('recentBookingsSummary', 'Sin turnos confirmados previos.', 'Ultimos turnos confirmados del cliente para sugerir repetir un servicio')
) AS v(key, default_value, description)
WHERE a.name = 'Illuminato Assistant'
  AND NOT EXISTS (SELECT 1 FROM variables WHERE agent_id = a.id AND key = v.key);

-- Mark old vars as deprecated
UPDATE variables SET description = description || ' (deprecado, usar userName)'
WHERE key = 'nombreCliente' AND description NOT LIKE '%deprecado%';
UPDATE variables SET description = description || ' (deprecado, usar phoneNumber)'
WHERE key = 'numeroTelefono' AND description NOT LIKE '%deprecado%';

-- Multi-company foundation
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  industry TEXT NOT NULL DEFAULT 'general',
  whatsapp_number TEXT,
  calendar_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin_empresa',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;
  ALTER TABLE users ADD CONSTRAINT chk_user_role
    CHECK (role IN ('superadmin', 'admin_empresa', 'professional'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  color_hex TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  duration_minutes INT NOT NULL DEFAULT 60,
  price INT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL UNIQUE REFERENCES professionals(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  refresh_token TEXT,
  google_account_email TEXT,
  token_updated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  google_event_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'bot',
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_message_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assistant_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success',
  system_prompt_resolved TEXT NOT NULL DEFAULT '',
  injected_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_tool_calls JSONB,
  executed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_message_traces_conversation_idx
  ON agent_message_traces(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS agent_message_traces_assistant_message_idx
  ON agent_message_traces(assistant_message_id);

DO $$ BEGIN
  ALTER TABLE agent_message_traces ADD CONSTRAINT chk_agent_message_trace_status
    CHECK (status IN ('success', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointment_status
    CHECK (status IN ('confirmed', 'cancelled', 'rescheduled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT chk_appointment_source
    CHECK (source IN ('bot', 'manual', 'google_calendar'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO companies (name, slug, industry, calendar_connected)
SELECT 'Talora Base', 'talora-base', 'general', false
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE slug = 'talora-base');

ALTER TABLE agents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_id UUID;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS professional_id UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS professional_id UUID;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS paused_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_professional_id;
  ALTER TABLE users ADD CONSTRAINT fk_users_professional_id
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS fk_clients_professional_id;
  ALTER TABLE clients ADD CONSTRAINT fk_clients_professional_id
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_conversations_professional_id;
  ALTER TABLE conversations ADD CONSTRAINT fk_conversations_professional_id
    FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS conversation_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  paused_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at TIMESTAMPTZ
);

WITH default_company AS (
  SELECT id FROM companies WHERE slug = 'talora-base' LIMIT 1
)
UPDATE agents
SET company_id = (SELECT id FROM default_company)
WHERE company_id IS NULL;

WITH default_company AS (
  SELECT id FROM companies WHERE slug = 'talora-base' LIMIT 1
)
UPDATE whatsapp_instances
SET company_id = (SELECT id FROM default_company)
WHERE company_id IS NULL;

WITH default_company AS (
  SELECT id FROM companies WHERE slug = 'talora-base' LIMIT 1
)
UPDATE conversations c
SET company_id = wi.company_id
FROM whatsapp_instances wi
WHERE c.company_id IS NULL
  AND c.instance_id = wi.id;

WITH default_company AS (
  SELECT id FROM companies WHERE slug = 'talora-base' LIMIT 1
)
UPDATE alerts
SET company_id = COALESCE(
  (SELECT wi.company_id FROM whatsapp_instances wi WHERE wi.id = alerts.instance_id),
  (SELECT id FROM default_company)
)
WHERE company_id IS NULL;

UPDATE clients cl
SET company_id = ag.company_id
FROM agents ag
WHERE cl.company_id IS NULL
  AND cl.agent_id = ag.id;

DO $$ BEGIN
  ALTER TABLE agents ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE whatsapp_instances ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE conversations ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alerts ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE clients ALTER COLUMN company_id SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_company_id ON agents(company_id);
CREATE INDEX IF NOT EXISTS idx_instances_company_id ON whatsapp_instances(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_company_id ON conversations(company_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_professional_id_unique ON users(professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_professional_id ON clients(company_id, professional_id, name);
CREATE INDEX IF NOT EXISTS idx_conversations_professional_id ON conversations(company_id, professional_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_professionals_company_id ON professionals(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_company_id ON services(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_pauses_company_id ON conversation_pauses(company_id, paused_at DESC);

ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS google_account_email TEXT;
ALTER TABLE google_calendar_connections ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ;
ALTER TABLE services ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';
UPDATE services SET aliases = '{}' WHERE aliases IS NULL;

ALTER TABLE services ADD COLUMN IF NOT EXISTS price INT;

DO $$
DECLARE
  has_price_label BOOLEAN;
  invalid_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'price_label'
  ) INTO has_price_label;

  IF has_price_label THEN
    SELECT COUNT(*)
    INTO invalid_count
    FROM services
    WHERE price IS NULL
      AND (
        price_label IS NULL
        OR btrim(price_label) = ''
        OR regexp_replace(price_label, '[^0-9]', '', 'g') = ''
      );

    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'Cannot migrate services.price_label to services.price: % rows contain non-numeric or empty prices. Fix the data first.', invalid_count;
    END IF;

    UPDATE services
    SET price = regexp_replace(price_label, '[^0-9]', '', 'g')::INT
    WHERE price IS NULL;

    ALTER TABLE services ALTER COLUMN price SET NOT NULL;
    ALTER TABLE services ALTER COLUMN price SET DEFAULT 0;
    ALTER TABLE services DROP COLUMN price_label;
  ELSE
    UPDATE services SET price = 0 WHERE price IS NULL;
    ALTER TABLE services ALTER COLUMN price SET NOT NULL;
    ALTER TABLE services ALTER COLUMN price SET DEFAULT 0;
  END IF;
END $$;

INSERT INTO variables (agent_id, key, default_value, description, category)
SELECT a.id,
       'recentBookingsSummary',
       'Sin turnos confirmados previos.',
       'Ultimos turnos confirmados del cliente para sugerir repetir un servicio',
       'system'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM variables v WHERE v.agent_id = a.id AND v.key = 'recentBookingsSummary'
);

UPDATE tools
SET source = 'core'
WHERE implementation IN (
  'google_calendar_check',
  'google_calendar_book',
  'google_calendar_reprogram',
  'google_calendar_cancel'
);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archive_reason TEXT;

DO $$ BEGIN
  ALTER TABLE conversations DROP CONSTRAINT IF EXISTS chk_conversation_archive_reason;
  ALTER TABLE conversations ADD CONSTRAINT chk_conversation_archive_reason
    CHECK (archive_reason IS NULL OR archive_reason IN ('manual_reset', 'inactive_48h'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_active_by_company
  ON conversations(company_id, archived_at, last_message_at DESC);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS escalation_number TEXT;

INSERT INTO variables (agent_id, key, default_value, description, category)
SELECT a.id, v.key, v.default_value, v.description, 'system'
FROM agents a, (VALUES
  ('company_name', '', 'Nombre de la empresa (alias de company.name)'),
  ('current_datetime', '', 'Fecha y hora actual (alias de fechaHoraActual)'),
  ('client_name', 'Cliente', 'Nombre del cliente (alias de userName)'),
  ('available_services', '', 'Servicios disponibles (alias de availableServices)'),
  ('available_professionals', '', 'Profesionales disponibles (alias de availableProfessionals)'),
  ('availability', 'Usar herramienta google_calendar_check para consultar disponibilidad.', 'Disponibilidad horaria (se resuelve por tool, no por inyeccion)'),
  ('client_appointments', 'Sin turnos confirmados previos.', 'Turnos del cliente (alias de recentBookingsSummary)')
) AS v(key, default_value, description)
WHERE NOT EXISTS (SELECT 1 FROM variables WHERE agent_id = a.id AND key = v.key);

INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
SELECT a.id,
       'escalate',
       'Escala la conversación a un humano enviando un mensaje de WhatsApp al número de escalación.',
       '{"type":"object","properties":{"reason":{"type":"string","description":"Razón corta de por qué se escala."}},"required":["reason"]}'::jsonb,
       'escalate',
       'core'
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.agent_id = a.id AND t.name = 'escalate'
);
`;

async function run() {
  try {
    console.log('Running migrations...');
    await pool.query(migration);
    console.log('Migrations complete.');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
