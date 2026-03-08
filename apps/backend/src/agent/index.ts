import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../db/pool';
import { EvolutionClient } from '../evolution/client';
import { executeTool } from './tool-executor';
import { checkSlot } from '../calendar/operations';
import { getAgentConfig } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Message, Conversation } from '@bottoo/shared';

const anthropic = new Anthropic({ maxRetries: 3, timeout: 60_000 });
const evolution = new EvolutionClient();

const MAX_TOOL_ITERATIONS = 10;
const CALENDAR_TOOLS = new Set(['google_calendar_check', 'google_calendar_book', 'google_calendar_cancel']);

// Simple per-conversation lock to prevent race conditions on concurrent messages
const conversationLocks = new Map<string, Promise<void>>();

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

function deserializeContentBlocks(toolCalls: unknown[]): Anthropic.ContentBlockParam[] {
  return toolCalls
    .filter((block): block is Record<string, unknown> => block !== null && typeof block === 'object')
    .map((block) => {
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id as string,
          name: block.name as string,
          input: block.input as Record<string, unknown>,
        };
      }
      if (block.type === 'text') {
        return {
          type: 'text' as const,
          text: (block.text as string) || '',
        };
      }
      // Fallback: treat as text
      return { type: 'text' as const, text: JSON.stringify(block) };
    });
}

async function processMessage(
  conversationId: string,
  instanceName: string,
  _messageText: string
) {
  try {
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

    const { agent, sections, tools } = agentConfig;

    const now = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    let systemPrompt = sections
      .map((s) => `## ${s.title}\n${s.content}`)
      .join('\n\n');

    // Inject variables
    let horariosDisponibles = 'No disponible';
    if (systemPrompt.includes('{{horariosDisponibles}}')) {
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const availability = await checkSlot(tomorrow.toISOString(), 60);
        if (availability.available) {
          horariosDisponibles = 'Mañana hay disponibilidad todo el día';
        } else if (availability.suggestions && availability.suggestions.length > 0) {
          horariosDisponibles = 'Horarios sugeridos: ' + availability.suggestions
            .map((s) => new Date(s).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))
            .join(', ');
        }
      } catch {
        horariosDisponibles = 'No se pudo consultar Google Calendar';
      }
    }

    systemPrompt = systemPrompt
      .replace(/\{\{fechaHoraActual\}\}/g, now)
      .replace(/\{\{nombreCliente\}\}/g, conversation.contact_name || 'Cliente')
      .replace(/\{\{numeroTelefono\}\}/g, conversation.phone_number)
      .replace(/\{\{horariosDisponibles\}\}/g, horariosDisponibles);

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    // Build messages for Anthropic
    const anthropicMessages: Anthropic.MessageParam[] = [];
    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        anthropicMessages.push({ role: 'user', content: msg.content || '' });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          anthropicMessages.push({
            role: 'assistant',
            content: deserializeContentBlocks(msg.tool_calls),
          });
        } else {
          anthropicMessages.push({ role: 'assistant', content: msg.content || '' });
        }
      } else if (msg.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || '',
              content: msg.content || '',
            },
          ],
        });
      }
    }

    // Call Anthropic API with tool use loop
    let response = await anthropic.messages.create({
      model: agent.model || 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    // Tool use loop with iteration limit
    let iterations = 0;
    while (response.stop_reason === 'tool_use') {
      iterations++;
      if (iterations > MAX_TOOL_ITERATIONS) {
        logger.error(`Tool loop exceeded ${MAX_TOOL_ITERATIONS} iterations for conversation ${conversationId}`);
        break;
      }

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Save assistant message with tool calls
      await pool.query(
        `INSERT INTO messages (conversation_id, role, content, tool_calls)
         VALUES ($1, 'assistant', $2, $3)`,
        [
          conversationId,
          null,
          JSON.stringify(response.content),
        ]
      );

      // Execute tools: parallel for non-calendar, sequential for calendar
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      const hasCalendarTool = toolUseBlocks.some((t) => CALENDAR_TOOLS.has(t.name));

      if (hasCalendarTool) {
        // Sequential execution for calendar tools to avoid race conditions
        for (const toolUse of toolUseBlocks) {
          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );
          await pool.query(
            `INSERT INTO messages (conversation_id, role, content, tool_call_id)
             VALUES ($1, 'tool', $2, $3)`,
            [conversationId, result, toolUse.id]
          );
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
        }
      } else {
        // Parallel execution for non-calendar tools
        const results = await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            const result = await executeTool(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
            await pool.query(
              `INSERT INTO messages (conversation_id, role, content, tool_call_id)
               VALUES ($1, 'tool', $2, $3)`,
              [conversationId, result, toolUse.id]
            );
            return { type: 'tool_result' as const, tool_use_id: toolUse.id, content: result };
          })
        );
        toolResults.push(...results);
      }

      // Continue the conversation
      anthropicMessages.push({ role: 'assistant', content: response.content });
      anthropicMessages.push({ role: 'user', content: toolResults });

      response = await anthropic.messages.create({
        model: agent.model || 'claude-opus-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const responseText = textBlocks.map((b) => b.text).join('\n');

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

    // Save error as alert
    await pool.query(
      `INSERT INTO alerts (type, message)
       VALUES ('agent_error', $1)`,
      [err instanceof Error ? err.message : 'Unknown error in agent']
    ).catch((dbErr) => logger.error('Failed to save error alert:', dbErr));
  }
}
