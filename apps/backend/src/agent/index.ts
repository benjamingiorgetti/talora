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

const CALENDAR_TOOLS = new Set(['google_calendar_check', 'google_calendar_book', 'google_calendar_cancel']);

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

    // Load conversation + messages (agent config comes from cache)
    const [convResult, messagesResult] = await Promise.all([
      pool.query<Conversation>('SELECT * FROM conversations WHERE id = $1', [conversationId]),
      pool.query<Message>(
        `SELECT * FROM messages WHERE conversation_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [conversationId]
      ),
    ]);

    if (convResult.rows.length === 0) return;
    const conversation = convResult.rows[0];
    const dbMessages = messagesResult.rows.reverse();

    // Load agent config from cache (sections + tools)
    const agentConfig = await getAgentConfig();
    if (!agentConfig) {
      logger.error('No agent configured');
      return;
    }

    const { agent, tools, variables } = agentConfig;

    // Resolve horariosDisponibles only if the prompt references it
    const variableOverrides: Record<string, string> = {};
    if (agent.system_prompt.includes('{{horariosDisponibles}}')) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const durationMinutes = 60;
        const dateKey = `${tomorrow.toISOString().split('T')[0]}-${durationMinutes}`;

        // Check cache first (key includes duration to avoid cross-duration collisions)
        const cached = getCachedAvailability(dateKey);
        const availability = cached ?? await withTimeout(
          checkSlot(tomorrow.toISOString(), durationMinutes),
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
      } catch {
        variableOverrides.horariosDisponibles = 'No se pudo consultar Google Calendar';
      }
    }

    const systemPrompt = buildSystemPrompt({
      systemPrompt: agent.system_prompt,
      customVariables: variables,
      conversation: {
        contact_name: conversation.contact_name ?? undefined,
        phone_number: conversation.phone_number,
      },
      timezone: config.timezone,
      variableOverrides,
    });

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
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
            executeTool(tc.function.name, args),
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
              executeTool(tc.function.name, args),
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
