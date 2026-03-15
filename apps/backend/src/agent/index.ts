import OpenAI from 'openai';
import { pool } from '../db/pool';
import { config } from '../config';
import { EvolutionClient } from '../evolution/client';
import { executeTool } from './tool-executor';
import { buildSystemPrompt } from './prompt-builder';

import { getAgentConfig } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { buildOpenAiMessages, buildOpenAiTools } from './openai-runtime';
import type { AgentToolExecutionTrace, Message, Conversation } from '@talora/shared';

const openai = new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 3, timeout: 60_000 });
const evolution = new EvolutionClient();

const CALENDAR_TOOLS = new Set(['google_calendar_check', 'google_calendar_book', 'google_calendar_cancel', 'google_calendar_reprogram']);

// Simple per-conversation lock to prevent race conditions on concurrent messages
const conversationLocks = new Map<string, Promise<void>>();

function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function safeJsonParse(value: string): Record<string, unknown> | string {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to raw string.
  }

  return value;
}

export function buildAgentToolTrace(
  toolCallId: string,
  name: string,
  input: Record<string, unknown>,
  rawResult: string,
): AgentToolExecutionTrace {
  const parsedResult = safeJsonParse(rawResult);
  const error =
    typeof parsedResult === 'object' && parsedResult && 'error' in parsedResult && typeof parsedResult.error === 'string'
      ? parsedResult.error
      : null;

  return {
    tool_call_id: toolCallId,
    name,
    status: error ? 'error' : 'success',
    input,
    output: parsedResult,
    error,
  };
}

async function persistAgentMessageTrace(params: {
  companyId: string;
  conversationId: string;
  agentId: string | null;
  assistantMessageId: string | null;
  status: 'success' | 'error';
  systemPromptResolved: string;
  injectedContext: Record<string, string>;
  requestedToolCalls: Record<string, unknown>[] | null;
  executedTools: AgentToolExecutionTrace[];
  errorMessage?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO agent_message_traces (
       company_id,
       conversation_id,
       agent_id,
       assistant_message_id,
       status,
       system_prompt_resolved,
       injected_context,
       requested_tool_calls,
       executed_tools,
       error_message
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)`,
    [
      params.companyId,
      params.conversationId,
      params.agentId,
      params.assistantMessageId,
      params.status,
      params.systemPromptResolved,
      JSON.stringify(params.injectedContext),
      params.requestedToolCalls ? JSON.stringify(params.requestedToolCalls) : null,
      JSON.stringify(params.executedTools),
      params.errorMessage ?? null,
    ],
  );
}

async function loadRecentBookingsSummary(
  companyId: string,
  phoneNumber: string,
  professionalId?: string | null
): Promise<string> {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) {
    return 'Sin turnos confirmados previos.';
  }

  const result = await pool.query<{
    service_name: string | null;
    professional_name: string | null;
    starts_at: string;
  }>(
    `SELECT s.name AS service_name,
            p.name AS professional_name,
            a.starts_at
     FROM appointments a
     LEFT JOIN services s ON s.id = a.service_id
     LEFT JOIN professionals p ON p.id = a.professional_id
     WHERE a.company_id = $1
       AND regexp_replace(a.phone_number, '\\D', '', 'g') = $2
       AND a.status = 'confirmed'
       AND ($3::uuid IS NULL OR a.professional_id = $3)
     ORDER BY a.created_at DESC
     LIMIT 3`,
    [companyId, normalizedPhone, professionalId ?? null]
  );

  if (result.rows.length === 0) {
    return 'Sin turnos confirmados previos.';
  }

  const [latest, ...rest] = result.rows;
  const formatBooking = (booking: { service_name: string | null; professional_name: string | null; starts_at: string }) => {
    const service = booking.service_name ?? 'servicio sin nombre';
    const withProfessional = booking.professional_name ? `${service} con ${booking.professional_name}` : service;
    const when = new Date(booking.starts_at).toLocaleString('es-AR', { timeZone: config.timezone });
    return `${withProfessional} (${when})`;
  };

  const parts = [`Ultimo turno confirmado: ${formatBooking(latest)}.`];
  if (rest.length > 0) {
    parts.push(`Historial reciente: ${rest.map(formatBooking).join(' | ')}.`);
  }
  return parts.join(' ');
}

export async function handleIncomingMessage(
  conversationId: string,
  instanceName: string,
  messageText: string
): Promise<void> {
  const prev = conversationLocks.get(conversationId) ?? Promise.resolve();
  const current = prev
    .then(() => processMessage(conversationId, instanceName, messageText))
    .catch((err) => logger.error('Error in conversation lock chain:', err))
    .finally(() => {
      // Only clean up if we're still the current promise (no new message queued)
      if (conversationLocks.get(conversationId) === current) {
        conversationLocks.delete(conversationId);
      }
    });
  conversationLocks.set(conversationId, current);
  await current;
}

async function processMessage(
  conversationId: string,
  instanceName: string,
  _messageText: string
) {
  let traceState: {
    companyId: string | null;
    agentId: string | null;
    systemPromptResolved: string;
    injectedContext: Record<string, string>;
    requestedToolCalls: Record<string, unknown>[];
    executedTools: AgentToolExecutionTrace[];
  } = {
    companyId: null,
    agentId: null,
    systemPromptResolved: '',
    injectedContext: {},
    requestedToolCalls: [],
    executedTools: [],
  };

  // Overall timeout for the entire processing pipeline
  const abortController = new AbortController();
  const overallTimer = setTimeout(() => abortController.abort(), config.agentTimeoutMs);

  try {
    // Check if already aborted before starting
    if (abortController.signal.aborted) throw new Error('Agent processing timeout');

    // Load conversation
    const convResult = await pool.query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (convResult.rows.length === 0) return;
    const conversation = convResult.rows[0];
    let professionalId: string | null = conversation.professional_id ?? null;

    // Auto-reset memory if conversation inactive for 48h
    const MEMORY_WINDOW_MS = 48 * 60 * 60 * 1000;
    if (conversation.last_message_at) {
      const lastActivity = new Date(conversation.last_message_at).getTime();
      if (Date.now() - lastActivity > MEMORY_WINDOW_MS) {
        await pool.query(
          'UPDATE conversations SET memory_reset_at = NOW() WHERE id = $1',
          [conversationId]
        );
      }
    }

    // Load messages within memory window (48h or since last reset)
    const messagesResult = await pool.query<Message>(
      `SELECT * FROM messages WHERE conversation_id = $1
         AND created_at > COALESCE(
           (SELECT memory_reset_at FROM conversations WHERE id = $1),
           NOW() - INTERVAL '48 hours'
         )
       ORDER BY created_at DESC LIMIT 20`,
      [conversationId]
    );
    const dbMessages = messagesResult.rows.reverse();

    // Load agent config from cache (sections + tools)
    const agentConfig = await getAgentConfig(conversation.company_id);
    if (!agentConfig) {
      logger.error('No agent configured');
      return;
    }

    const { agent, tools, variables } = agentConfig;
    traceState.companyId = conversation.company_id;
    traceState.agentId = agent.id;
    const variableKeys = new Set(variables.map((variable) => variable.key));

    // Resolve system context based on declared variables, not prompt string heuristics.
    const variableOverrides: Record<string, string> = {};
    if (variableKeys.has('contextoCliente')) {
      try {
        const clientResult = await pool.query<{
          name: string; client_type: string; branch: string;
          delivery_days: string; payment_terms: string; notes: string;
        }>(
          `SELECT name, client_type, branch, delivery_days, payment_terms, notes
           FROM clients WHERE company_id = $1 AND phone_number = $2 AND is_active = true
             AND ($3::uuid IS NULL OR professional_id = $3)
           LIMIT 1`,
          [conversation.company_id, conversation.phone_number, professionalId]
        );
        if (clientResult.rows.length > 0) {
          const c = clientResult.rows[0];
          const lines: string[] = [];
          if (c.name) lines.push(`Nombre: ${c.name}`);
          if (c.client_type) lines.push(`Tipo: ${c.client_type}`);
          if (c.branch) lines.push(`Sucursal: ${c.branch}`);
          if (c.delivery_days) lines.push(`Dias de entrega: ${c.delivery_days}`);
          if (c.payment_terms) lines.push(`Condicion de pago: ${c.payment_terms}`);
          if (c.notes) lines.push(`Notas: ${c.notes}`);
          variableOverrides.contextoCliente = lines.length > 0 ? lines.join('\n') : 'Cliente registrado (sin datos adicionales)';
        }
      } catch (err) {
        logger.error('Error resolving contextoCliente:', err);
      }
    }

    try {
      variableOverrides.recentBookingsSummary = await loadRecentBookingsSummary(
        conversation.company_id,
        conversation.phone_number,
        professionalId,
      );
    } catch (err) {
      logger.error('Error resolving recent bookings summary:', err);
      variableOverrides.recentBookingsSummary = 'Sin turnos confirmados previos.';
    }

    // Resolve company_name alias
    if (variableKeys.has('company_name')) {
      try {
        const compResult = await pool.query<{ name: string }>(
          'SELECT name FROM companies WHERE id = $1',
          [conversation.company_id]
        );
        variableOverrides.company_name = compResult.rows[0]?.name ?? '';
      } catch (err) {
        logger.error('Error resolving company_name:', err);
      }
    }

    if (variableKeys.has('availableServices') || variableKeys.has('availableProfessionals') || variableKeys.has('available_services') || variableKeys.has('available_professionals')) {
      try {
        const [servicesResult, professionalsResult] = await Promise.all([
          pool.query<{
            name: string;
            duration_minutes: number;
            price: number;
            professional_name: string | null;
          }>(
            `SELECT s.name, s.duration_minutes, s.price, p.name AS professional_name
             FROM services s
             LEFT JOIN professionals p ON p.id = s.professional_id
             WHERE s.company_id = $1 AND s.is_active = true
               AND ($2::uuid IS NULL OR s.professional_id IS NULL OR s.professional_id = $2)
             ORDER BY s.name ASC`,
            [conversation.company_id, professionalId]
          ),
          pool.query<{ name: string; specialty: string | null }>(
            `SELECT name, specialty
             FROM professionals
             WHERE company_id = $1 AND is_active = true
               AND ($2::uuid IS NULL OR id = $2)
             ORDER BY name ASC`,
            [conversation.company_id, professionalId]
          ),
        ]);

        variableOverrides.availableServices =
          servicesResult.rows.length > 0
            ? servicesResult.rows.map((service) => {
                const details = [
                  `${service.duration_minutes} min`,
                  service.price >= 0 ? `$${service.price.toLocaleString('es-AR')}` : null,
                  service.professional_name ? `con ${service.professional_name}` : null,
                ].filter(Boolean);
                return details.length > 0 ? `${service.name} (${details.join(', ')})` : service.name;
              }).join(' | ')
            : 'Sin servicios cargados';

        variableOverrides.availableProfessionals =
          professionalsResult.rows.length > 0
            ? professionalsResult.rows.map((professional) => (
                professional.specialty ? `${professional.name} (${professional.specialty})` : professional.name
              )).join(' | ')
            : 'Sin profesionales cargados';
      } catch (err) {
        logger.error('Error resolving available services/professionals:', err);
      }
    }

    // Propagate snake_case aliases for services/professionals
    if (variableOverrides.availableServices !== undefined) {
      variableOverrides.available_services = variableOverrides.availableServices;
    }
    if (variableOverrides.availableProfessionals !== undefined) {
      variableOverrides.available_professionals = variableOverrides.availableProfessionals;
    }

    // Resolve professional context for nombreProfesional/professionalId variables
    if (professionalId && (variableKeys.has('nombreProfesional') || variableKeys.has('professionalId'))) {
      try {
        const profResult = await pool.query<{ id: string; name: string }>(
          'SELECT id, name FROM professionals WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
          [professionalId, conversation.company_id]
        );
        if (profResult.rows[0]) {
          variableOverrides.nombreProfesional = profResult.rows[0].name;
          variableOverrides.professionalId = profResult.rows[0].id;
        }
      } catch (err) {
        logger.error('Error resolving professional context:', err);
      }
    }

    // availability/horariosDisponibles: resolved 100% by google_calendar_check tool at runtime
    // No injection needed — defaults in prompt-builder instruct the agent to use the tool
    if (variableOverrides.recentBookingsSummary !== undefined) {
      variableOverrides.client_appointments = variableOverrides.recentBookingsSummary;
    }

    const systemPrompt = buildSystemPrompt({
      systemPrompt: agent.system_prompt,
      customVariables: variables,
      conversation: {
        id: conversation.id,
        contact_name: conversation.contact_name ?? undefined,
        phone_number: conversation.phone_number,
      },
      agentId: agent.id,
      timezone: config.timezone,
      variableOverrides,
    });
    traceState.systemPromptResolved = systemPrompt;
    traceState.injectedContext = { ...variableOverrides };

    const openaiTools = buildOpenAiTools(tools);
    const openaiMessages = buildOpenAiMessages(systemPrompt, dbMessages);

    // Call OpenAI API with tool use loop
    let response = await openai.chat.completions.create({
      model: agent.model || 'gpt-4o-mini',
      max_completion_tokens: 2048,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });
    let choice = response.choices[0];

    // Tool use loop with configurable iteration limit
    let iterations = 0;
    while (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      iterations++;
      if (iterations > config.maxToolIterations) {
        logger.error(`Tool loop exceeded ${config.maxToolIterations} iterations for conversation ${conversationId}`);
        break;
      }

      // Check overall timeout
      if (abortController.signal.aborted) {
        throw new Error('Agent processing timeout');
      }

      const toolCalls = choice.message.tool_calls;
      traceState.requestedToolCalls.push(...(JSON.parse(JSON.stringify(toolCalls)) as Record<string, unknown>[]));

      // Save assistant message with tool calls
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content, tool_calls)
         VALUES ($1, 'assistant', $2, $3)`,
        [
          conversationId,
          choice.message.content || null,
          JSON.stringify(toolCalls),
        ]
      );

      // Execute tools: parallel for non-calendar, sequential for calendar
      // Each tool execution is wrapped with a per-tool timeout
      const toolMessages: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
      const hasCalendarTool = toolCalls.some((tc) => CALENDAR_TOOLS.has(tc.function.name));

      if (hasCalendarTool) {
        // Sequential execution for calendar tools to avoid race conditions
        for (const tc of toolCalls) {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const result = await withTimeout(
            executeTool(tc.function.name, args, {
              companyId: conversation.company_id,
              conversationId: conversation.id,
              phoneNumber: conversation.phone_number,
              contactName: conversation.contact_name,
              professionalId,
            }),
            config.toolTimeoutMs,
            `tool:${tc.function.name}`,
          );
          traceState.executedTools.push(buildAgentToolTrace(tc.id, tc.function.name, args, result));
          await pool.query(
            `INSERT INTO messages (conversation_id, role, content, tool_call_id)
             VALUES ($1, 'tool', $2, $3)`,
            [conversationId, result, tc.id]
          );
          toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });

          // Re-read professional_id in case a tool bound it to the conversation
          if (!professionalId) {
            const refreshed = await pool.query<{ professional_id: string | null }>(
              'SELECT professional_id FROM conversations WHERE id = $1',
              [conversationId]
            );
            if (refreshed.rows[0]?.professional_id) {
              professionalId = refreshed.rows[0].professional_id;
            }
          }
        }
      } else {
        // Parallel execution for non-calendar tools
        const results = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
            const result = await withTimeout(
              executeTool(tc.function.name, args, {
                companyId: conversation.company_id,
                conversationId: conversation.id,
                phoneNumber: conversation.phone_number,
                contactName: conversation.contact_name,
                professionalId,
              }),
              config.toolTimeoutMs,
              `tool:${tc.function.name}`,
            );
            await pool.query(
              `INSERT INTO messages (conversation_id, role, content, tool_call_id)
               VALUES ($1, 'tool', $2, $3)`,
              [conversationId, result, tc.id]
            );
            return {
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: result,
              trace: buildAgentToolTrace(tc.id, tc.function.name, args, result),
            };
          })
        );
        traceState.executedTools.push(...results.map((result) => result.trace));
        toolMessages.push(...results.map(({ role, tool_call_id, content }) => ({ role, tool_call_id, content })));
      }

      // Continue the conversation
      openaiMessages.push({ role: 'assistant', content: choice.message.content || null, tool_calls: toolCalls });
      openaiMessages.push(...toolMessages);

      response = await openai.chat.completions.create({
        model: agent.model || 'gpt-4o-mini',
        max_completion_tokens: 2048,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });
      choice = response.choices[0];
    }

    // Extract final text response
    const responseText = choice.message.content || '';

    // Save assistant message to DB
    const assistantMessageResult = await pool.query<{ id: string }>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING id`,
      [conversationId, responseText]
    );

    try {
      await persistAgentMessageTrace({
        companyId: conversation.company_id,
        conversationId,
        agentId: agent.id,
        assistantMessageId: assistantMessageResult.rows[0]?.id ?? null,
        status: 'success',
        systemPromptResolved: systemPrompt,
        injectedContext: { ...variableOverrides },
        requestedToolCalls: traceState.requestedToolCalls.length > 0 ? traceState.requestedToolCalls : null,
        executedTools: traceState.executedTools,
      });
    } catch (traceErr) {
      logger.error('Failed to persist agent message trace:', traceErr);
    }

    // Update conversation last_message_at
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Send response via EvolutionAPI
    if (responseText) {
      await evolution.sendText(instanceName, conversation.phone_number, responseText);
    }
  } catch (err) {
    logger.error('Error handling incoming message:', err);

    if (traceState.companyId && traceState.systemPromptResolved) {
      try {
        await persistAgentMessageTrace({
          companyId: traceState.companyId,
          conversationId,
          agentId: traceState.agentId,
          assistantMessageId: null,
          status: 'error',
          systemPromptResolved: traceState.systemPromptResolved,
          injectedContext: traceState.injectedContext,
          requestedToolCalls: traceState.requestedToolCalls.length > 0 ? traceState.requestedToolCalls : null,
          executedTools: traceState.executedTools,
          errorMessage: err instanceof Error ? err.message : 'Unknown error during agent execution',
        });
      } catch (traceErr) {
        logger.error('Failed to persist error trace for conversation:', traceErr);
      }
    }

    // If it was a timeout, try to send a fallback message to the user
    if (err instanceof Error && err.message.includes('Timeout')) {
      try {
        const convResult = await pool.query<Conversation>(
          'SELECT phone_number FROM conversations WHERE id = $1',
          [conversationId]
        );
        if (convResult.rows.length > 0) {
          await evolution.sendText(
            instanceName,
            convResult.rows[0].phone_number,
            'Lo siento, hubo un problema procesando tu mensaje. Por favor intentá de nuevo.',
          );
        }
      } catch (fallbackErr) {
        logger.error('Failed to send timeout fallback message:', fallbackErr);
      }
    }

    // Save error as alert
    await pool.query(
      `INSERT INTO alerts (type, message)
       VALUES ('agent_error', $1)`,
      [err instanceof Error ? err.message : 'Unknown error in agent']
    ).catch((dbErr) => logger.error('Failed to save error alert:', dbErr));
  } finally {
    clearTimeout(overallTimer);
  }
}
