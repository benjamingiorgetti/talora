import { checkSlot, bookSlot, deleteEvent } from '../calendar/operations';
import { validateWebhookUrl } from '../utils/url-validator';
import { logger } from '../utils/logger';

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'google_calendar_check': {
        const date = toolInput.date as string;
        const durationMinutes = (toolInput.durationMinutes as number) || 60;
        const result = await checkSlot(date, durationMinutes);
        return JSON.stringify(result);
      }

      case 'google_calendar_book': {
        const name = toolInput.name as string;
        const date = toolInput.date as string;
        const durationMinutes = (toolInput.durationMinutes as number) || 60;
        const description = (toolInput.description as string) || '';
        const result = await bookSlot(name, date, durationMinutes, description);
        return JSON.stringify(result);
      }

      case 'google_calendar_cancel': {
        const eventId = toolInput.eventId as string;
        const result = await deleteEvent(eventId);
        return JSON.stringify(result);
      }

      case 'webhook': {
        const url = toolInput.url as string;
        validateWebhookUrl(url);
        const payload = toolInput.payload || toolInput;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        const text = await response.text();
        return text;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    logger.error(`Tool execution error (${toolName}):`, err);
    return JSON.stringify({
      error: `Tool execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
}
