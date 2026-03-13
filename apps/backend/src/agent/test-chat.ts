import OpenAI from 'openai';
import { pool } from '../db/pool';
import { config } from '../config';
import { getAgentConfig } from '../cache/agent-cache';
import { buildSystemPrompt } from './prompt-builder';
import { executeTool } from './tool-executor';
import { isResetCommand, RESET_CONFIRMATION_MESSAGE } from '../conversations/reset';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { buildOpenAiMessages, buildOpenAiTools } from './openai-runtime';
import type { TestChatMode, TestChatResponse, TestMessage, TestToolTrace } from '@talora/shared';

const openai = new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 3, timeout: 60_000 });

function executeDryRunTool(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'google_calendar_check':
      return JSON.stringify({ available: true, message: '[TEST] Horario disponible (mock)' });
    case 'google_calendar_book':
      return JSON.stringify({ success: true, eventId: 'test-event-123', message: '[TEST] Turno reservado (mock)' });
    case 'google_calendar_cancel':
      return JSON.stringify({ success: true, message: '[TEST] Evento cancelado (mock)' });
    case 'google_calendar_reprogram':
      return JSON.stringify({ success: true, message: '[TEST] Evento reprogramado (mock)' });
    case 'webhook':
      return JSON.stringify({ status: 200, message: '[TEST] Webhook enviado (mock)' });
    default:
      return JSON.stringify({ message: `[TEST] Tool ${toolName} executed (mock)`, args });
  }
}

function safeJsonParse(value: string): Record<string, unknown> | string {
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

function buildToolTrace(
  toolCallId: string,
  name: string,
  mode: TestChatMode,
  input: Record<string, unknown>,
  rawResult: string
): TestToolTrace {
  const parsedResult = safeJsonParse(rawResult);
  const error =
    typeof parsedResult === 'object' && parsedResult && 'error' in parsedResult && typeof parsedResult.error === 'string'
      ? parsedResult.error
      : null;

  return {
    tool_call_id: toolCallId,
    name,
    mode,
    status: error ? 'error' : 'success',
    input,
    output: parsedResult,
    error,
  };
}

async function resolveTestContext(sessionId: string): Promise<{
  companyId: string;
  professionalId: string | null;
  phoneNumber: string;
  contactName: string;
}> {
  const sessionResult = await pool.query<{
    company_id: string;
    professional_id: string | null;
    phone_number: string;
    contact_name: string;
  }>(
    `SELECT a.company_id,
            NULL::uuid AS professional_id,
            '+5491100000000'::text AS phone_number,
            'Cliente de prueba'::text AS contact_name
     FROM test_sessions ts
     JOIN agents a ON a.id = ts.agent_id
     WHERE ts.id = $1
     LIMIT 1`,
    [sessionId]
  );

  const row = sessionResult.rows[0];
  if (!row?.company_id) {
    throw new Error('No company configured for test session');
  }

  return {
    companyId: row.company_id,
    professionalId: row.professional_id,
    phoneNumber: row.phone_number,
    contactName: row.contact_name,
  };
}

async function resolveDefaultProfessionalId(companyId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM professionals
     WHERE company_id = $1 AND is_active = true
     ORDER BY created_at ASC
     LIMIT 2`,
    [companyId]
  );

  return result.rows.length === 1 ? result.rows[0].id : null;
}

export async function handleTestMessage(
  sessionId: string,
  messageText: string,
  mode: TestChatMode = 'live'
): Promise<TestChatResponse> {
  if (isResetCommand(messageText)) {
    await pool.query('DELETE FROM test_messages WHERE session_id = $1', [sessionId]);
    return {
      content: RESET_CONFIRMATION_MESSAGE,
      executed_tools: [],
      mode,
    };
  }

  const testContext = await resolveTestContext(sessionId);
  const professionalId = testContext.professionalId ?? await resolveDefaultProfessionalId(testContext.companyId);

  const agentConfig = await getAgentConfig(testContext.companyId);
  if (!agentConfig) {
    throw new Error('No agent configured');
  }

  const { agent, tools, variables } = agentConfig;
  const systemPromptRaw = agent.system_prompt || '';

  await pool.query(
    `INSERT INTO test_messages (session_id, role, content)
     VALUES ($1, 'user', $2)`,
    [sessionId, messageText]
  );

  const systemPrompt = buildSystemPrompt({
    systemPrompt: systemPromptRaw,
    customVariables: variables,
    conversation: { id: 'test-session', contact_name: testContext.contactName, phone_number: testContext.phoneNumber },
    agentId: agent.id,
    timezone: config.timezone,
    variableOverrides: {
      contextoCliente: 'Cliente de prueba (modo test real)',
      recentBookingsSummary: 'Sin turnos confirmados previos en modo test.',
    },
  });

  const historyResult = await pool.query<TestMessage>(
    `SELECT * FROM test_messages WHERE session_id = $1
     ORDER BY created_at ASC LIMIT 40`,
    [sessionId]
  );

  const openaiMessages = buildOpenAiMessages(systemPrompt, historyResult.rows, {
    mapToolContent: (message) => {
      const rawContent = message.content || '';
      const parsedContent = safeJsonParse(rawContent);
      return typeof parsedContent === 'object' && parsedContent && 'output' in parsedContent
        ? JSON.stringify(parsedContent.output)
        : rawContent;
    },
  });
  const openaiTools = buildOpenAiTools(tools);

  let response = await openai.chat.completions.create({
    model: agent.model || 'gpt-4o-mini',
    max_completion_tokens: 2048,
    messages: openaiMessages,
    tools: openaiTools.length > 0 ? openaiTools : undefined,
  });
  let choice = response.choices[0];
  const executedTools: TestToolTrace[] = [];

  let iterations = 0;
  while (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
    iterations++;
    if (iterations > config.maxToolIterations) {
      logger.error(`Test chat tool loop exceeded ${config.maxToolIterations} iterations`);
      break;
    }

    const toolCalls = choice.message.tool_calls;

    await pool.query(
      `INSERT INTO test_messages (session_id, role, content, tool_calls)
       VALUES ($1, 'assistant', $2, $3)`,
      [sessionId, choice.message.content || null, JSON.stringify(toolCalls)]
    );

    const toolMessages: OpenAI.Chat.ChatCompletionToolMessageParam[] = [];
    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const rawResult =
        mode === 'simulate'
          ? executeDryRunTool(toolCall.function.name, args)
          : await withTimeout(
              executeTool(toolCall.function.name, args, {
                companyId: testContext.companyId,
                conversationId: `test:${sessionId}`,
                phoneNumber: testContext.phoneNumber,
                contactName: testContext.contactName,
                professionalId,
              }),
              config.toolTimeoutMs,
              `test-tool:${toolCall.function.name}`
            );
      const trace = buildToolTrace(toolCall.id, toolCall.function.name, mode, args, rawResult);
      executedTools.push(trace);

      await pool.query(
        `INSERT INTO test_messages (session_id, role, content, tool_call_id)
         VALUES ($1, 'tool', $2, $3)`,
        [sessionId, JSON.stringify(trace), toolCall.id]
      );

      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: typeof trace.output === 'string' ? trace.output : JSON.stringify(trace.output),
      });
    }

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

  const responseText = choice.message.content || '';
  const finalToolCalls = choice.message.tool_calls;

  await pool.query(
    `INSERT INTO test_messages (session_id, role, content, tool_calls)
     VALUES ($1, 'assistant', $2, $3)`,
    [
      sessionId,
      responseText,
      finalToolCalls ? JSON.stringify(finalToolCalls) : null,
    ]
  );

  return {
    content: responseText,
    executed_tools: executedTools,
    mode,
    ...(finalToolCalls ? { tool_calls: finalToolCalls } : {}),
  };
}
