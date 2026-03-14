import { describe, it, expect, beforeEach } from 'bun:test';
import {
  isValidUuid,
  parsePositiveInt,
  validateBody,
  createAppointmentSchema,
  reprogramAppointmentSchema,
  createProfessionalSchema,
  updateProfessionalSchema,
  createServiceSchema,
  serviceImportPreviewSchema,
  createClientSchema,
  createCompanySchema,
  manualMessageSchema,
  testChatMessageSchema,
} from '../validation';
import {
  createMockReq,
  createMockRes,
  createMockNext,
} from '../../__test-utils__/mock-request';

// ---------------------------------------------------------------------------
// isValidUuid
// ---------------------------------------------------------------------------

describe('isValidUuid', () => {
  it('should return true for a valid lowercase UUID v4', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return true for a valid uppercase UUID', () => {
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('should return false for a random string', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidUuid('')).toBe(false);
  });

  it('should return false for a UUID missing a segment', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('should return false for a UUID with extra characters', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000X')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parsePositiveInt
// ---------------------------------------------------------------------------

describe('parsePositiveInt', () => {
  it('should parse "5" to 5', () => {
    expect(parsePositiveInt('5', 10)).toBe(5);
  });

  it('should return 0 for "0" (zero is valid)', () => {
    expect(parsePositiveInt('0', 10)).toBe(0);
  });

  it('should return null for "-1" (negative)', () => {
    expect(parsePositiveInt('-1', 10)).toBeNull();
  });

  it('should return null for "abc" (non-numeric)', () => {
    expect(parsePositiveInt('abc', 10)).toBeNull();
  });

  it('should return the fallback when value is undefined', () => {
    expect(parsePositiveInt(undefined, 42)).toBe(42);
  });

  it('should return the fallback when value is null', () => {
    expect(parsePositiveInt(null, 99)).toBe(99);
  });

  it('should parse numeric values passed as numbers', () => {
    expect(parsePositiveInt(7, 0)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// createAppointmentSchema
// ---------------------------------------------------------------------------

describe('createAppointmentSchema', () => {
  it('should pass with only the required starts_at field', () => {
    const result = createAppointmentSchema.safeParse({
      starts_at: '2025-06-15T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('should apply defaults for optional fields', () => {
    const result = createAppointmentSchema.safeParse({
      starts_at: '2025-06-15T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.client_name).toBe('Cliente');
      expect(result.data.phone_number).toBe('');
      expect(result.data.notes).toBe('');
    }
  });

  it('should pass with all fields provided', () => {
    const result = createAppointmentSchema.safeParse({
      professional_id: '550e8400-e29b-41d4-a716-446655440000',
      service_id: '550e8400-e29b-41d4-a716-446655440001',
      starts_at: '2025-06-15T10:00:00.000Z',
      client_name: 'Juan Pérez',
      phone_number: '+5491122334455',
      notes: 'Traer turno anterior',
      conversation_id: '550e8400-e29b-41d4-a716-446655440002',
      source: 'manual',
    });
    expect(result.success).toBe(true);
  });

  it('should fail when starts_at is missing', () => {
    const result = createAppointmentSchema.safeParse({
      client_name: 'Juan',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when starts_at is an empty string', () => {
    const result = createAppointmentSchema.safeParse({ starts_at: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when source has an invalid enum value', () => {
    const result = createAppointmentSchema.safeParse({
      starts_at: '2025-06-15T10:00:00.000Z',
      source: 'invalid_source',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reprogramAppointmentSchema
// ---------------------------------------------------------------------------

describe('reprogramAppointmentSchema', () => {
  it('should pass with only starts_at', () => {
    const result = reprogramAppointmentSchema.safeParse({
      starts_at: '2025-07-01T09:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('should pass with all optional fields included', () => {
    const result = reprogramAppointmentSchema.safeParse({
      starts_at: '2025-07-01T09:00:00.000Z',
      professional_id: '550e8400-e29b-41d4-a716-446655440000',
      service_id: '',
      notes: 'Reprogramado por el cliente',
    });
    expect(result.success).toBe(true);
  });

  it('should fail when starts_at is missing', () => {
    const result = reprogramAppointmentSchema.safeParse({
      notes: 'Sin fecha',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when starts_at is an empty string', () => {
    const result = reprogramAppointmentSchema.safeParse({ starts_at: '' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createProfessionalSchema
// ---------------------------------------------------------------------------

describe('createProfessionalSchema', () => {
  const base = {
    name: 'Dra. Laura Gómez',
    calendar_id: 'primary',
  };

  it('should pass with required fields only', () => {
    const result = createProfessionalSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('should pass with user_email AND user_password together', () => {
    const result = createProfessionalSchema.safeParse({
      ...base,
      user_email: 'laura@clinic.com',
      user_password: 'securePass1',
    });
    expect(result.success).toBe(true);
  });

  it('should fail when user_email is provided without user_password', () => {
    const result = createProfessionalSchema.safeParse({
      ...base,
      user_email: 'laura@clinic.com',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when user_password is provided without user_email', () => {
    const result = createProfessionalSchema.safeParse({
      ...base,
      user_password: 'securePass1',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when name is missing', () => {
    const result = createProfessionalSchema.safeParse({ calendar_id: 'primary' });
    expect(result.success).toBe(false);
  });

  it('should fail when calendar_id is missing', () => {
    const result = createProfessionalSchema.safeParse({ name: 'Dra. Laura' });
    expect(result.success).toBe(false);
  });

  it('should fail when color_hex has an invalid format', () => {
    const result = createProfessionalSchema.safeParse({
      ...base,
      color_hex: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('should pass with a valid color_hex', () => {
    const result = createProfessionalSchema.safeParse({
      ...base,
      color_hex: '#A1B2C3',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateProfessionalSchema
// ---------------------------------------------------------------------------

describe('updateProfessionalSchema', () => {
  it('should pass with an empty object (all fields optional)', () => {
    const result = updateProfessionalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should pass with a partial update (only name)', () => {
    const result = updateProfessionalSchema.safeParse({ name: 'Dr. Nuevo Nombre' });
    expect(result.success).toBe(true);
  });

  it('should pass with a partial update (only is_active)', () => {
    const result = updateProfessionalSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it('should fail when name is explicitly set to empty string', () => {
    const result = updateProfessionalSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when user_password is shorter than 8 chars', () => {
    const result = updateProfessionalSchema.safeParse({ user_password: 'short' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createServiceSchema
// ---------------------------------------------------------------------------

describe('createServiceSchema', () => {
  const base = {
    name: 'Corte de cabello',
    price: 1500,
  };

  it('should pass with name and price', () => {
    const result = createServiceSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for optional fields', () => {
    const result = createServiceSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration_minutes).toBe(60);
      expect(result.data.aliases).toEqual([]);
      expect(result.data.is_active).toBe(true);
    }
  });

  it('should fail when name is missing', () => {
    const result = createServiceSchema.safeParse({ price: 500 });
    expect(result.success).toBe(false);
  });

  it('should fail when aliases array has more than 20 items', () => {
    const tooManyAliases = Array.from({ length: 21 }, (_, i) => `alias${i}`);
    const result = createServiceSchema.safeParse({ ...base, aliases: tooManyAliases });
    expect(result.success).toBe(false);
  });

  it('should fail when an alias string exceeds 100 characters', () => {
    const longAlias = 'a'.repeat(101);
    const result = createServiceSchema.safeParse({ ...base, aliases: [longAlias] });
    expect(result.success).toBe(false);
  });

  it('should pass with exactly 20 aliases each within 100 chars', () => {
    const maxAliases = Array.from({ length: 20 }, (_, i) => `alias${i}`);
    const result = createServiceSchema.safeParse({ ...base, aliases: maxAliases });
    expect(result.success).toBe(true);
  });

  it('should fail when duration_minutes is below the minimum (5)', () => {
    const result = createServiceSchema.safeParse({ ...base, duration_minutes: 4 });
    expect(result.success).toBe(false);
  });

  it('should fail when duration_minutes exceeds maximum (480)', () => {
    const result = createServiceSchema.safeParse({ ...base, duration_minutes: 481 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serviceImportPreviewSchema
// ---------------------------------------------------------------------------

describe('serviceImportPreviewSchema', () => {
  const validRow = { row_number: 2, name: 'Servicio A', price: 100, duration_minutes: 30 };

  it('should pass with one valid row', () => {
    const result = serviceImportPreviewSchema.safeParse({ rows: [validRow] });
    expect(result.success).toBe(true);
  });

  it('should pass with 1000 rows (maximum)', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ ...validRow, row_number: i + 2 }));
    const result = serviceImportPreviewSchema.safeParse({ rows });
    expect(result.success).toBe(true);
  });

  it('should fail with an empty rows array', () => {
    const result = serviceImportPreviewSchema.safeParse({ rows: [] });
    expect(result.success).toBe(false);
  });

  it('should fail with 1001 rows (exceeds maximum)', () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ ...validRow, row_number: i + 2 }));
    const result = serviceImportPreviewSchema.safeParse({ rows });
    expect(result.success).toBe(false);
  });

  it('should fail when rows is missing entirely', () => {
    const result = serviceImportPreviewSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createClientSchema
// ---------------------------------------------------------------------------

describe('createClientSchema', () => {
  it('should pass with name and phone_number', () => {
    const result = createClientSchema.safeParse({
      phone_number: '+5491122334455',
      name: 'María Fernández',
    });
    expect(result.success).toBe(true);
  });

  it('should pass with only phone_number (name has a default)', () => {
    const result = createClientSchema.safeParse({ phone_number: '+5491122334455' });
    expect(result.success).toBe(true);
  });

  it('should fail when phone_number is missing', () => {
    const result = createClientSchema.safeParse({ name: 'Sin Teléfono' });
    expect(result.success).toBe(false);
  });

  it('should fail when phone_number exceeds 30 characters', () => {
    const longPhone = '1'.repeat(31);
    const result = createClientSchema.safeParse({ phone_number: longPhone });
    expect(result.success).toBe(false);
  });

  it('should pass when phone_number is exactly 30 characters', () => {
    const maxPhone = '1'.repeat(30);
    const result = createClientSchema.safeParse({ phone_number: maxPhone });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createCompanySchema
// ---------------------------------------------------------------------------

describe('createCompanySchema', () => {
  const base = {
    name: 'Clínica Bienestar',
    industry: 'salud',
    admin_email: 'admin@bienestar.com',
    admin_password: 'password123',
    admin_full_name: 'Admin Bienestar',
  };

  it('should pass with required fields only', () => {
    const result = createCompanySchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('should pass with nested professionals and services', () => {
    const result = createCompanySchema.safeParse({
      ...base,
      professionals: [
        { name: 'Dr. García', specialty: 'Cardiología', calendar_id: 'cal-1', color_hex: '#FF5733' },
      ],
      services: [
        { name: 'Consulta', duration_minutes: 30, price: 2000, description: 'Consulta básica' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should apply empty defaults for professionals and services', () => {
    const result = createCompanySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.professionals).toEqual([]);
      expect(result.data.services).toEqual([]);
    }
  });

  it('should fail when name is missing', () => {
    const { name: _n, ...withoutName } = base;
    const result = createCompanySchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it('should fail when admin_email is not a valid email', () => {
    const result = createCompanySchema.safeParse({
      ...base,
      admin_email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when admin_password is shorter than 8 characters', () => {
    const result = createCompanySchema.safeParse({
      ...base,
      admin_password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// manualMessageSchema
// ---------------------------------------------------------------------------

describe('manualMessageSchema', () => {
  it('should pass with a single character content', () => {
    const result = manualMessageSchema.safeParse({ content: 'H' });
    expect(result.success).toBe(true);
  });

  it('should pass with content at exactly 5000 characters', () => {
    const result = manualMessageSchema.safeParse({ content: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('should fail with empty content', () => {
    const result = manualMessageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('should fail with content exceeding 5000 characters', () => {
    const result = manualMessageSchema.safeParse({ content: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('should fail when content field is missing', () => {
    const result = manualMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// testChatMessageSchema
// ---------------------------------------------------------------------------

describe('testChatMessageSchema', () => {
  const validSessionId = '550e8400-e29b-41d4-a716-446655440000';

  it('should pass with session_id and content', () => {
    const result = testChatMessageSchema.safeParse({
      session_id: validSessionId,
      content: 'Hola, quiero un turno',
    });
    expect(result.success).toBe(true);
  });

  it('should pass with mode "live"', () => {
    const result = testChatMessageSchema.safeParse({
      session_id: validSessionId,
      content: 'test',
      mode: 'live',
    });
    expect(result.success).toBe(true);
  });

  it('should pass with mode "simulate"', () => {
    const result = testChatMessageSchema.safeParse({
      session_id: validSessionId,
      content: 'test',
      mode: 'simulate',
    });
    expect(result.success).toBe(true);
  });

  it('should fail with an invalid mode value', () => {
    const result = testChatMessageSchema.safeParse({
      session_id: validSessionId,
      content: 'test',
      mode: 'unknown_mode',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when session_id is not a valid UUID', () => {
    const result = testChatMessageSchema.safeParse({
      session_id: 'bad-id',
      content: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when content is missing', () => {
    const result = testChatMessageSchema.safeParse({ session_id: validSessionId });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateBody middleware
// ---------------------------------------------------------------------------

describe('validateBody middleware', () => {
  it('should call next() when body is valid', () => {
    const middleware = validateBody(manualMessageSchema);
    const req = createMockReq({ body: { content: 'Mensaje válido' } });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should mutate req.body with parsed (coerced) data when valid', () => {
    const middleware = validateBody(createAppointmentSchema);
    const req = createMockReq({
      body: { starts_at: '2025-06-15T10:00:00.000Z' },
    });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req as any, res as any, next);

    // After middleware, defaults should be applied
    expect(req.body.client_name).toBe('Cliente');
    expect(req.body.notes).toBe('');
  });

  it('should return 400 when body is invalid', () => {
    const middleware = validateBody(manualMessageSchema);
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should include a field path in the error message when available', () => {
    const middleware = validateBody(manualMessageSchema);
    const req = createMockReq({ body: { content: '' } });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.json as ReturnType<typeof import('bun:test').mock>).mock.calls[0][0] as {
      error: string;
    };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('should not call next() when body is invalid', () => {
    const middleware = validateBody(testChatMessageSchema);
    const req = createMockReq({ body: { content: 'msg' } }); // missing session_id
    const res = createMockRes();
    const next = createMockNext();

    middleware(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
