// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import type { Variable } from '@talora/shared';
import { makeConversation, TEST_IDS } from '../../__test-utils__/factories';

// ──────────────────────────────────────────────────────────
// Freeze time so fechaHoraActual is deterministic.
// We patch Date globally before importing the module under test.
// ──────────────────────────────────────────────────────────
const FIXED_ISO = '2026-03-14T15:30:00.000Z'; // UTC → 12:30 ART (UTC-3)
const OriginalDate = globalThis.Date;

class FrozenDate extends OriginalDate {
  constructor(...args: ConstructorParameters<typeof OriginalDate>) {
    if (args.length === 0) {
      super(FIXED_ISO);
    } else {
      // @ts-ignore — spread over overloaded constructor
      super(...args);
    }
  }

  static now() {
    return new OriginalDate(FIXED_ISO).getTime();
  }
}

// Patch before importing the module so `new Date()` inside it is frozen.
globalThis.Date = FrozenDate as unknown as typeof Date;

const {
  getSystemVariableValues,
  buildSystemPrompt,
  getResolvedPreview,
} = await import('../prompt-builder');

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const TIMEZONE = 'America/Argentina/Buenos_Aires';

function makeCustomVariable(overrides: Partial<Variable> = {}): Variable {
  return {
    id: 'var-test-1',
    agent_id: TEST_IDS.AGENT_A,
    key: 'miVariable',
    default_value: 'valorDefecto',
    description: 'Variable de prueba',
    category: 'custom',
    created_at: '2026-03-14T12:00:00.000Z',
    ...overrides,
  };
}

function makeBaseCtx(overrides: Partial<Parameters<typeof buildSystemPrompt>[0]> = {}) {
  return {
    systemPrompt: 'Sos un asistente de turnos.',
    customVariables: [] as Variable[],
    timezone: TIMEZONE,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────
// getSystemVariableValues
// ──────────────────────────────────────────────────────────

describe('getSystemVariableValues', () => {
  it('should populate userName and phoneNumber from conversation context', () => {
    const conv = makeConversation({
      contact_name: 'María López',
      phone_number: '5491155559999',
    });

    const vars = getSystemVariableValues({ conversation: conv, timezone: TIMEZONE });

    expect(vars.userName).toBe('María López');
    expect(vars.phoneNumber).toBe('5491155559999');
  });

  it('should return empty strings for userName and phoneNumber when no conversation is provided', () => {
    const vars = getSystemVariableValues({ timezone: TIMEZONE });

    // userName falls back to 'Cliente' (the contact name default), phoneNumber to ''
    // The source uses: contactName = ctx.conversation?.contact_name || 'Cliente'
    expect(vars.phoneNumber).toBe('');
    // userName falls back to 'Cliente' when there is no contact_name
    expect(vars.userName).toBe('Cliente');
  });

  it('should return empty strings for phoneNumber when conversation has no phone_number', () => {
    const conv = makeConversation({ phone_number: undefined });

    const vars = getSystemVariableValues({ conversation: conv, timezone: TIMEZONE });

    expect(vars.phoneNumber).toBe('');
  });

  it('should include fechaHoraActual with content derived from the frozen current date', () => {
    const vars = getSystemVariableValues({ timezone: TIMEZONE });

    // The frozen UTC time 2026-03-14T15:30:00Z in ART (UTC-3) → 12:30 on 14/3/2026.
    // We only assert it contains the expected date fragment to avoid locale sensitivity.
    expect(vars.fechaHoraActual).toContain('2026');
    expect(vars.fechaHoraActual).toContain('14');
  });

  it('should populate backward-compatible alias nombreCliente from contact_name', () => {
    const conv = makeConversation({ contact_name: 'Carlos' });

    const vars = getSystemVariableValues({ conversation: conv, timezone: TIMEZONE });

    expect(vars.nombreCliente).toBe('Carlos');
  });

  it('should populate backward-compatible alias numeroTelefono from phone_number', () => {
    const conv = makeConversation({ phone_number: '5491155551234' });

    const vars = getSystemVariableValues({ conversation: conv, timezone: TIMEZONE });

    expect(vars.numeroTelefono).toBe('5491155551234');
  });

  it('should populate sessionId from conversation id', () => {
    const conv = makeConversation({ id: TEST_IDS.CONV_A });

    const vars = getSystemVariableValues({ conversation: conv, timezone: TIMEZONE });

    expect(vars.sessionId).toBe(TEST_IDS.CONV_A);
  });

  it('should populate idTenant from agentId', () => {
    const vars = getSystemVariableValues({
      agentId: TEST_IDS.AGENT_A,
      timezone: TIMEZONE,
    });

    expect(vars.idTenant).toBe(TEST_IDS.AGENT_A);
  });
});

// ──────────────────────────────────────────────────────────
// buildSystemPrompt
// ──────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('should replace {{variable}} with a custom variable default value', () => {
    const customVar = makeCustomVariable({ key: 'miVariable', default_value: 'valorDefecto' });
    const ctx = makeBaseCtx({
      systemPrompt: 'El valor es {{miVariable}}.',
      customVariables: [customVar],
    });

    const result = buildSystemPrompt(ctx);

    expect(result).toContain('El valor es valorDefecto.');
    expect(result).not.toContain('{{miVariable}}');
  });

  it('should replace {{fechaHoraActual}} with the resolved system variable value', () => {
    const ctx = makeBaseCtx({ systemPrompt: 'Hoy es {{fechaHoraActual}}.' });

    const result = buildSystemPrompt(ctx);

    expect(result).not.toContain('{{fechaHoraActual}}');
    // The resolved date must contain the year from the frozen timestamp.
    expect(result).toContain('2026');
  });

  it('should leave unknown {{variable}} placeholders unreplaced', () => {
    const ctx = makeBaseCtx({ systemPrompt: 'Algo con {{variableDesconocida}}.' });

    const result = buildSystemPrompt(ctx);

    expect(result).toContain('{{variableDesconocida}}');
  });

  it('should not double-substitute when a variable value itself contains {{}}', () => {
    // A custom variable whose value contains another placeholder syntax.
    const dangerous = makeCustomVariable({
      key: 'safe',
      default_value: '{{userName}} could be injected',
    });
    const conv = makeConversation({ contact_name: 'Injectee' });
    const ctx = makeBaseCtx({
      systemPrompt: 'Val: {{safe}}',
      customVariables: [dangerous],
      conversation: conv,
    });

    const result = buildSystemPrompt(ctx);

    // The substitution runs in a single pass (replaceAll per key), so the
    // inner {{userName}} that appears *inside* the resolved value of {{safe}}
    // should NOT be expanded a second time — it should remain literal.
    expect(result).toContain('{{userName}} could be injected');
    // The outer {{safe}} must be gone.
    expect(result).not.toContain('{{safe}}');
  });

  it('should return empty string when systemPrompt is empty', () => {
    const ctx = makeBaseCtx({ systemPrompt: '' });

    const result = buildSystemPrompt(ctx);

    expect(result).toBe('');
  });

  it('should apply variableOverrides over system and custom variable values', () => {
    const ctx = makeBaseCtx({
      systemPrompt: 'Nombre: {{userName}}',
      variableOverrides: { userName: 'OverriddenName' },
    });

    const result = buildSystemPrompt(ctx);

    expect(result).toContain('Nombre: OverriddenName');
  });

  it('should not replace system-category variables from customVariables (only custom category)', () => {
    // A Variable with category='system' should be ignored in the custom-vars loop.
    const systemVar = makeCustomVariable({
      key: 'fechaHoraActual',
      default_value: 'WRONG_DATE',
      category: 'system',
    });
    const ctx = makeBaseCtx({
      systemPrompt: 'Fecha: {{fechaHoraActual}}',
      customVariables: [systemVar],
    });

    const result = buildSystemPrompt(ctx);

    // Should be resolved from system variables, not the 'system'-category customVariable,
    // which is skipped. The resolved value must NOT be 'WRONG_DATE'.
    expect(result).not.toContain('WRONG_DATE');
    expect(result).not.toContain('{{fechaHoraActual}}');
  });
});

// ──────────────────────────────────────────────────────────
// getResolvedPreview
// ──────────────────────────────────────────────────────────

describe('getResolvedPreview', () => {
  it('should return a resolved prompt identical to buildSystemPrompt', () => {
    const ctx = makeBaseCtx({
      systemPrompt: 'Hola {{userName}}, hoy es {{fechaHoraActual}}.',
      customVariables: [makeCustomVariable({ key: 'x', default_value: '42' })],
      conversation: makeConversation({ contact_name: 'Lucía' }),
    });

    const preview = getResolvedPreview(ctx);
    const direct = buildSystemPrompt(ctx);

    expect(preview).toBe(direct);
  });

  it('should not contain any unresolved known system variable placeholders', () => {
    const ctx = makeBaseCtx({
      systemPrompt:
        '{{userName}} {{phoneNumber}} {{fechaHoraActual}} {{sessionId}} {{idTenant}} {{nombreCliente}} {{numeroTelefono}}',
      conversation: makeConversation(),
    });

    const preview = getResolvedPreview(ctx);

    const knownVars = [
      'userName',
      'phoneNumber',
      'fechaHoraActual',
      'sessionId',
      'idTenant',
      'nombreCliente',
      'numeroTelefono',
    ];
    for (const v of knownVars) {
      expect(preview).not.toContain(`{{${v}}}`);
    }
  });
});
