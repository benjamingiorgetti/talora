import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// --- Reusable primitives ---

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().or(z.literal('').transform(() => undefined));
const isoDatetime = z.string().min(1, 'ISO datetime string required');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #FF00AA');
const serviceAliases = z.array(z.string().trim().min(1).max(100)).max(20);

// --- Middleware ---

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const path = firstIssue?.path?.join('.') || '';
      const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message ?? 'Invalid request body';
      res.status(400).json({ error: message });
      return;
    }
    req.body = result.data;
    next();
  };
}

// --- UUID / integer helpers (moved from conversations.ts for reuse) ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function parsePositiveInt(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

// --- Appointment schemas ---

export const createAppointmentSchema = z.object({
  professional_id: uuid.optional(),
  service_id: optionalUuid,
  starts_at: isoDatetime,
  client_name: z.string().max(200).default('Cliente'),
  phone_number: z.string().max(30).default(''),
  notes: z.string().max(2000).default(''),
  conversation_id: z.string().uuid().nullable().optional().default(null),
  source: z.enum(['manual', 'bot', 'google_calendar']).optional(),
});

export const reprogramAppointmentSchema = z.object({
  starts_at: isoDatetime,
  professional_id: optionalUuid,
  service_id: optionalUuid,
  notes: z.string().max(2000).nullable().optional(),
});

// --- Professional schemas ---

export const createProfessionalSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  calendar_id: z.string().min(1, 'calendar_id is required'),
  specialty: z.string().max(200).default(''),
  color_hex: hexColor.optional().nullable(),
  is_active: z.boolean().default(true),
  user_email: z.string().email().optional(),
  user_password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  user_full_name: z.string().max(200).optional(),
  user_is_active: z.boolean().default(true),
}).refine(
  (data) => (data.user_email && data.user_password) || (!data.user_email && !data.user_password),
  { message: 'user_email and user_password must be provided together' }
);

export const updateProfessionalSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  calendar_id: z.string().min(1).optional(),
  specialty: z.string().max(200).optional(),
  color_hex: hexColor.optional().nullable(),
  is_active: z.boolean().optional(),
  user_email: z.string().email().optional(),
  user_password: z.string().min(8).optional(),
  user_full_name: z.string().max(200).optional(),
  user_is_active: z.boolean().optional(),
});

// --- Service schemas ---

export const createServiceSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  professional_id: optionalUuid,
  aliases: serviceAliases.default([]),
  duration_minutes: z.number().int().min(5).max(480).default(60),
  price: z.number().int().min(0),
  description: z.string().max(1000).default(''),
  is_active: z.boolean().default(true),
});

export const updateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  professional_id: optionalUuid.nullable(),
  aliases: serviceAliases.optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  price: z.number().int().min(0).optional(),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
});

export const serviceImportPreviewSchema = z.object({
  rows: z.array(z.object({
    row_number: z.number().int().min(2),
    name: z.string().max(2000).optional().default(''),
    price: z.number().int().nullable().optional().default(null),
    duration_minutes: z.number().nullable().optional().default(null),
  })).min(1).max(1000),
});

export const serviceImportApplySchema = z.object({
  items: z.array(z.object({
    row_number: z.number().int().min(2),
    action: z.enum(['create', 'update', 'invalid']),
    service_id: z.string().uuid().nullable().optional().default(null),
    name: z.string().max(2000).optional().default(''),
    price: z.number().int().nullable().optional().default(null),
    duration_minutes: z.number().nullable().optional().default(null),
    error: z.string().nullable().optional().default(null),
  })).min(1).max(1000),
});

// --- Client schemas ---

export const createClientSchema = z.object({
  phone_number: z.string().min(1, 'phone_number is required').max(30),
  name: z.string().max(200).default(''),
  professional_id: optionalUuid,
  client_type: z.string().max(100).default('cliente'),
  branch: z.string().max(500).default(''),
  delivery_days: z.string().max(500).default(''),
  payment_terms: z.string().max(500).default(''),
  notes: z.string().max(2000).default(''),
  is_active: z.boolean().default(true),
});

export const updateClientSchema = z.object({
  phone_number: z.string().min(1).max(30).optional(),
  name: z.string().max(200).optional(),
  professional_id: optionalUuid,
  client_type: z.string().max(100).optional(),
  branch: z.string().max(500).optional(),
  delivery_days: z.string().max(500).optional(),
  payment_terms: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  is_active: z.boolean().optional(),
});

// --- Company schemas ---

export const createCompanySchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  industry: z.string().min(1, 'industry is required').max(200),
  admin_email: z.string().email('Valid admin email is required'),
  admin_password: z.string().min(8, 'Admin password must be at least 8 characters'),
  admin_full_name: z.string().min(1, 'admin_full_name is required').max(200),
  whatsapp_number: z.string().max(30).optional(),
  professionals: z.array(z.object({
    name: z.string().max(200).optional(),
    specialty: z.string().max(200).optional(),
    calendar_id: z.string().optional(),
    color_hex: hexColor.optional(),
  })).default([]),
  services: z.array(z.object({
    name: z.string().max(200).optional(),
    aliases: serviceAliases.optional(),
    duration_minutes: z.number().int().min(5).max(480).optional(),
    price: z.number().int().min(0).optional(),
    description: z.string().max(1000).optional(),
  })).default([]),
});

// --- Conversation schemas ---

export const manualMessageSchema = z.object({
  content: z.string().min(1, 'content is required').max(5000),
});

// --- Test chat schemas ---

export const testChatMessageSchema = z.object({
  session_id: uuid,
  content: z.string().min(1, 'content is required').max(5000),
  mode: z.enum(['live', 'simulate']).optional(),
});
