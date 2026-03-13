import type { AgentTool, AgentToolSource } from '@talora/shared';

export type CoreToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  implementation: string;
};

function createSchedulingParameters(options: { includeClientFields?: boolean } = {}): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      date: { type: 'string', description: options.includeClientFields ? 'Fecha y hora ISO del turno a reservar.' : 'Fecha y hora ISO propuesta para el turno.' },
      professionalId: { type: 'string', description: 'Identificador interno del profesional, solo si ya fue resuelto por el sistema.' },
      professionalName: { type: 'string', description: 'Nombre humano del profesional pedido por el cliente, por ejemplo Juli o Julieta.' },
      serviceName: { type: 'string', description: 'Nombre humano del servicio pedido por el cliente, por ejemplo corte, barba o corte + barba.' },
      serviceId: { type: 'string', description: 'Identificador interno del servicio, solo si ya fue resuelto por el sistema.' },
      ...(options.includeClientFields
        ? {
            name: { type: 'string', description: 'Nombre del cliente para el evento.' },
            description: { type: 'string', description: 'Notas o aclaraciones del turno.' },
          }
        : {}),
      durationMinutes: { type: 'number', description: 'Duracion del turno en minutos, si no se usa la del servicio.' },
    },
    required: ['date'],
  };
}

export const CORE_TOOL_DEFINITIONS: CoreToolDefinition[] = [
  {
    name: 'google_calendar_check',
    description: 'Consulta disponibilidad real en Google Calendar para el servicio que el cliente quiere reservar.',
    parameters: createSchedulingParameters(),
    implementation: 'google_calendar_check',
  },
  {
    name: 'google_calendar_book',
    description: 'Reserva un turno real y crea el appointment interno para el cliente actual.',
    parameters: createSchedulingParameters({ includeClientFields: true }),
    implementation: 'google_calendar_book',
  },
  {
    name: 'google_calendar_reprogram',
    description: 'Reprograma un turno existente a una nueva fecha y hora disponible.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID interno del turno en Talora.' },
        startsAt: { type: 'string', description: 'Nueva fecha y hora ISO del turno.' },
      },
      required: ['appointmentId', 'startsAt'],
    },
    implementation: 'google_calendar_reprogram',
  },
  {
    name: 'google_calendar_cancel',
    description: 'Cancela un turno existente en Google Calendar y en Talora.',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'ID interno del turno en Talora.' },
        eventId: { type: 'string', description: 'ID del evento en Google Calendar si ya se conoce.' },
      },
    },
    implementation: 'google_calendar_cancel',
  },
];

const CORE_TOOLS_BY_NAME = new Map(CORE_TOOL_DEFINITIONS.map((definition) => [definition.name, definition]));
const CORE_TOOLS_BY_IMPLEMENTATION = new Map(CORE_TOOL_DEFINITIONS.map((definition) => [definition.implementation, definition]));

export function isCoreToolName(name: string): boolean {
  return CORE_TOOLS_BY_NAME.has(name);
}

export function isCoreToolImplementation(implementation: string): boolean {
  return CORE_TOOLS_BY_IMPLEMENTATION.has(implementation);
}

export function getCoreToolDefinition(identifier: string): CoreToolDefinition | null {
  return CORE_TOOLS_BY_NAME.get(identifier) ?? CORE_TOOLS_BY_IMPLEMENTATION.get(identifier) ?? null;
}

export function applyCoreToolDefinition(tool: AgentTool): AgentTool {
  const definition = getCoreToolDefinition(tool.implementation) ?? getCoreToolDefinition(tool.name);
  if (!definition) return tool;

  return {
    ...tool,
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    implementation: definition.implementation,
    source: 'core',
  };
}

export function buildDefaultCoreTools(agentId: string): Array<Pick<AgentTool, 'agent_id' | 'name' | 'description' | 'parameters' | 'implementation' | 'is_active' | 'source'>> {
  return CORE_TOOL_DEFINITIONS.map((definition) => ({
    agent_id: agentId,
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    implementation: definition.implementation,
    is_active: true,
    source: 'core' satisfies AgentToolSource,
  }));
}
