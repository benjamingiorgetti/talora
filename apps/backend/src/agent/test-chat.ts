import OpenAI from 'openai';
import { pool } from '../db/pool';
import { config } from '../config';
import { getAgentConfig } from '../cache/agent-cache';
import { buildSystemPrompt } from './prompt-builder';
import { logger } from '../utils/logger';
import { deserializeToolCalls } from './utils';
import type { TestMessage } from '@talora/shared';

const openai = new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 3, timeout: 60_000 });

/**
 * Return mock results for tool calls in test/dry-run mode.
 * No real external calls are made.
 */
function executeDryRunTool(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'google_calendar_check':
      return JSON.stringify({ available: true, message: '[TEST] Horario disponible (mock)' });
    case 'google_calendar_book':
      return JSON.stringify({ success: true, eventId: 'test-event-123', message: '[TEST] Turno reservado (mock)' });
    case 'google_calendar_cancel':
      return JSON.stringify({ success: true, message: '[TEST] Evento cancelado (mock)' });
    case 'webhook':
      return JSON.stringify({ status: 200, message: '[TEST] Webhook enviado (mock)' });
    default:
      return JSON.stringify({ message: `[TEST] Tool ${toolName} executed (mock)`, args });
  }
}

/**
 * Handle a test chat message. Uses the same prompt building and OpenAI call
 * as production, but tools run in dry-run mode (mocked) and messages are
 * stored in test_messages instead of messages.
 */
export async function handleTestMessage(
  sessionId: string,
  messageText: string,
): Promise<{ content: string; tool_calls?: unknown[] }> {
  const sessionResult = await pool.query<{ company_id: string }>(
    `SELECT a.company_id
     FROM test_sessions ts
     JOIN agents a ON a.id = ts.agent_id
     WHERE ts.id = $1
     LIMIT 1`,
    [sessionId]
  );
  const companyId = sessionResult.rows[0]?.company_id;
  if (!companyId) {
    throw new Error('No company configured for test session');
  }

  // Load agent config from cache
  const agentConfig = await getAgentConfig(companyId);
  if (!agentConfig) {
    throw new Error('No agent configured');
  }

  const { agent, tools, variables } = agentConfig;

  // Ensure system_prompt is a string
  const systemPromptRaw = agent.system_prompt || '';

  // Save user message to test_messages
  await pool.query(
    `INSERT INTO test_messages (session_id, role, content)
     VALUES ($1, 'user', $2)`,
    [sessionId, messageText],
  );

  // Build system prompt with default variable values (no real conversation context)
  const systemPrompt = buildSystemPrompt({
    systemPrompt: systemPromptRaw,
    customVariables: variables,
    conversation: { id: 'test-session', contact_name: 'Usuario de prueba', phone_number: '+0000000000' },
    agentId: agent.id,
    timezone: config.timezone,
    variableOverrides: { contextoCliente: 'Cliente de prueba (modo test)' },
  });

  // Load history from test_messages
  const historyResult = await pool.query<TestMessage>(
    `SELECT * FROM test_messages WHERE session_id = $1
     ORDER BY created_at ASC LIMIT 40`,
    [sessionId],
  );

  // Build OpenAI messages
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of historyResult.rows) {
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

  // Build OpenAI tools definition (ensure valid JSON Schema parameters)
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

  // Call OpenAI
  let response = await openai.chat.completions.create({
    model: agent.model || 'gpt-4o-mini',
    max_completion_tokens: 2048,
    messages: openaiMessages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
  });
  let choice = response.choices[0];

  // Tool use loop with dry-run execution
  let iterations = 0;
  while (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    iterations++;
    if (iterations > config.maxToolIterations) {
      logger.error(`Test chat tool loop exceeded ${config.maxToolIterations} iterations`);
      break;
    }

    const toolCalls = choice.message.tool_calls;

    // Save assistant message with tool calls
    await pool.query(
      `INSERT INTO test_messages (session_id, role, content, tool_calls)
       VALUES ($1, 'assistant', $2, $3)`,
      [sessionId, choice.message.content || null, JSON.stringify(toolCalls)],
    );

    // Execute tools in dry-run mode
    const toolMessages: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
    for (const tc of toolCalls) {
      const args = JSON.parse(tc.function.arguments);
      const result = executeDryRunTool(tc.function.name, args);

      await pool.query(
        `INSERT INTO test_messages (session_id, role, content, tool_call_id)
         VALUES ($1, 'tool', $2, $3)`,
        [sessionId, result, tc.id],
      );
      toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }

    // Continue the conversation
    openaiMessages.push({
      role: 'assistant',
      content: choice.message.content || null,
      tool_calls: toolCalls,
    });
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
  const finalToolCalls = choice.message.tool_calls;

  // Save assistant response to test_messages
  await pool.query(
    `INSERT INTO test_messages (session_id, role, content, tool_calls)
     VALUES ($1, 'assistant', $2, $3)`,
    [
      sessionId,
      responseText,
      finalToolCalls ? JSON.stringify(finalToolCalls) : null,
    ],
  );

  return {
    content: responseText,
    ...(finalToolCalls ? { tool_calls: finalToolCalls } : {}),
  };
}
