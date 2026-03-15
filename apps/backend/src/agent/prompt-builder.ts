import type { Variable } from '@talora/shared';

export interface PromptBuildContext {
  systemPrompt: string;
  customVariables: Variable[];
  conversation?: { id?: string; contact_name?: string; phone_number?: string };
  agentId?: string;
  timezone: string;
  variableOverrides?: Record<string, string>;
}

export function formatFriendlyDateTime(date: Date, timezone: string): string {
  const datePart = date.toLocaleDateString('es-AR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('es-AR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart}, ${timePart}`;
}

/**
 * Compute the resolved values for system variables (fechaHoraActual, etc.)
 * based on the current time and conversation context.
 */
export function getSystemVariableValues(ctx: Pick<PromptBuildContext, 'conversation' | 'agentId' | 'timezone'>): Record<string, string> {
  const now = formatFriendlyDateTime(new Date(), ctx.timezone);
  const contactName = ctx.conversation?.contact_name || 'Cliente';
  const phoneNumber = ctx.conversation?.phone_number || '';
  return {
    fechaHoraActual: now,
    // New canonical vars
    userName: contactName,
    phoneNumber: phoneNumber,
    sessionId: ctx.conversation?.id || '',
    idTenant: ctx.agentId || '',
    contextoCliente: 'Cliente no registrado',
    recentBookingsSummary: 'Sin turnos confirmados previos.',
    nombreProfesional: '',
    professionalId: '',
    // Backward-compat aliases
    nombreCliente: contactName,
    numeroTelefono: phoneNumber,
    horariosDisponibles: 'Usar herramienta google_calendar_check para consultar disponibilidad.',
    // Snake-case aliases for flexible prompts
    company_name: '',
    current_datetime: now,
    client_name: contactName,
    available_services: '',
    available_professionals: '',
    availability: 'Usar herramienta google_calendar_check para consultar disponibilidad.',
    client_appointments: 'Sin turnos confirmados previos.',
  };
}

/**
 * Build the full system prompt from the unified system_prompt string,
 * variables.
 * Resolves all {{variable}} placeholders using system vars, custom vars, and overrides.
 */
export function buildSystemPrompt(ctx: PromptBuildContext): string {
  const systemVars = getSystemVariableValues(ctx);

  // Build template vars map: system vars + custom vars + overrides
  const templateVars: Record<string, string> = {};

  // System variables
  for (const [key, value] of Object.entries(systemVars)) {
    templateVars[`{{${key}}}`] = value;
  }

  // Custom variables (default values)
  for (const v of ctx.customVariables) {
    if (v.category === 'custom') {
      templateVars[`{{${v.key}}}`] = v.default_value;
    }
  }

  // Overrides (for test mode or runtime resolution like horariosDisponibles)
  if (ctx.variableOverrides) {
    for (const [key, value] of Object.entries(ctx.variableOverrides)) {
      templateVars[`{{${key}}}`] = value;
    }
  }

  const applyVars = (text: string): string => {
    let result = text;
    for (const [key, value] of Object.entries(templateVars)) {
      result = result.replaceAll(key, value);
    }
    return result;
  };

  return applyVars(ctx.systemPrompt);
}

/**
 * Return the resolved prompt preview using default variable values.
 * Useful for the prompt preview endpoint in the admin panel.
 */
export function getResolvedPreview(ctx: PromptBuildContext): string {
  return buildSystemPrompt(ctx);
}
