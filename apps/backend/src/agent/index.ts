import OpenAI from 'openai';
import { pool } from '../db/pool';
import { config } from '../config';
import { EvolutionClient } from '../evolution/client';
import { executeTool } from './tool-executor';
import { buildSystemPrompt } from './prompt-builder';
import { checkSlot } from '../calendar/operations';
import { getAgentConfig } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { deserializeToolCalls } from './utils';
import type { Message, Conversation } from '@talora/shared';

const openai = new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 3, timeout: 60_000 });
const evolution = new EvolutionClient();

const CALENDAR_TOOLS = new Set(['google_calendar_check', 'google_calendar_book', 'google_calendar_cancel', 'google_calendar_reprogram']);

// Simple per-conversation lock to prevent race conditions on concurrent messages
const conversationLocks = new Map<string, Promise<void>>();

// In-memory cache for calendar availability results (TTL: 5 minutes, max 100 entries)
const availabilityCache = new Map<string, { result: { available: boolean; suggestions?: string[] }; timestamp: number }>();
const AVAILABILITY_CACHE_TTL = 300_000; // 5 minutes
const MAX_AVAILABILITY_ENTRIES = 100;

function getCachedAvailability(dateKey: string): { available: boolean; suggestions?: string[] } | null {
  const entry = availabilityCache.get(dateKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > AVAILABILITY_CACHE_TTL) {
    availabilityCache.delete(dateKey);
    return null;
  }
  return entry.result;
}

function setCachedAvailability(dateKey: string, result: { available: boolean; suggestions?: string[] }): void {
  availabilityCache.set(dateKey, { result, timestamp: Date.now() });
  // Evict oldest entries if cache exceeds max size
  if (availabilityCache.size > MAX_AVAILABILITY_ENTRIES) {
    const firstKey = availabilityCache.keys().next().value;
    if (firstKey) availabilityCache.delete(firstKey);
  }
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
    const professionalId: string | null = conversation.professional_id ?? null;

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

    // Resolve contextoCliente if the prompt references it
    const variableOverrides: Record<string, string> = {};
    if (agent.system_prompt.includes('{{contextoCliente}}')) {
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

    if (agent.system_prompt.includes('{{availableServices}}') || agent.system_prompt.includes('{{availableProfessionals}}')) {
      try {
        const [servicesResult, professionalsResult] = await Promise.all([
          pool.query<{
            name: string;
            duration_minutes: number;
            price_label: string;
            professional_name: string | null;
          }>(
            `SELECT s.name, s.duration_minutes, s.price_label, p.name AS professional_name
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
                  service.price_label || null,
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

    // Resolve horariosDisponibles only if the prompt references it
    if (agent.system_prompt.includes('{{horariosDisponibles}}')) {
      try {
        let calendarId: string | undefined;
        let targetProfessionalId: string | undefined;

        if (professionalId) {
          const profResult = await pool.query<{ id: string; calendar_id: string; name: string }>(
            'SELECT id, calendar_id, name FROM professionals WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
            [professionalId, conversation.company_id]
          );
          if (profResult.rows[0]) {
            calendarId = profResult.rows[0].calendar_id;
            targetProfessionalId = profResult.rows[0].id;
            variableOverrides.nombreProfesional = profResult.rows[0].name;
            variableOverrides.professionalId = profResult.rows[0].id;
          }
        } else {
          variableOverrides.horariosDisponibles = 'No hay profesional asignado a esta conversación. No se puede consultar disponibilidad.';
          variableOverrides.nombreProfesional = '';
          variableOverrides.professionalId = '';
        }

        if (calendarId && targetProfessionalId) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(10, 0, 0, 0);
          const durationMinutes = 60;
          // Include professionalId in cache key to avoid cross-professional collisions
          const dateKey = `${targetProfessionalId}:${tomorrow.toISOString().split('T')[0]}-${durationMinutes}`;

          // Check cache first (key includes duration and professional to avoid collisions)
          const cached = getCachedAvailability(dateKey);
          const availability = cached ?? await withTimeout(
            checkSlot(tomorrow.toISOString(), durationMinutes, calendarId, targetProfessionalId),
            10_000,
            'checkSlot:availability-injection',
          );

          // Cache the result if it was freshly fetched
          if (!cached) {
            setCachedAvailability(dateKey, availability);
          }

          if (availability.available) {
            variableOverrides.horariosDisponibles = 'Mañana hay disponibilidad todo el día';
          } else if (availability.suggestions && availability.suggestions.length > 0) {
            variableOverrides.horariosDisponibles = 'Horarios sugeridos: ' + availability.suggestions
              .map((s) => new Date(s).toLocaleString('es-AR', { timeZone: config.timezone }))
              .join(', ');
          }
        }
      } catch {
        variableOverrides.horariosDisponibles = 'No se pudo consultar Google Calendar';
      }
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

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: (t.parameters && typeof t.parameters === 'object' && Object.keys(t.parameters).length > 0)
          ? t.parameters as Record<string, unknown>
          : { type: 'object', properties: {} },
      },
    }));

    // Build messages for OpenAI
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        openaiMessages.push({ role: 'user', content: msg.content || '' });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          openaiMessages.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: deserializeToolCalls(msg.tool_calls),
          });
        } else {
          openaiMessages.push({ role: 'assistant', content: msg.content || '' });
        }
      } else if (msg.role === 'tool') {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: msg.tool_call_id || '',
          content: msg.content || '',
        });
      }
    }

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
          const args = JSON.parse(tc.function.arguments);
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
          toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      } else {
        // Parallel execution for non-calendar tools
        const results = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = JSON.parse(tc.function.arguments);
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
            return { role: 'tool' as const, tool_call_id: tc.id, content: result };
          })
        );
        toolMessages.push(...results);
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
    await pool.query(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)`,
      [conversationId, responseText]
    );

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
