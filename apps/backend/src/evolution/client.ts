import { config } from '../config';
import { logger } from '../utils/logger';

/** Total number of attempts (1 initial + retries). RETRY_DELAYS length must be >= MAX_ATTEMPTS - 1. */
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS = [1000, 2000, 4000];
const REQUEST_TIMEOUT = 15_000;

export class EvolutionClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.evolutionApiUrl.replace(/\/$/, '');
    this.apiKey = config.evolutionApiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`EvolutionAPI ${method} ${path} failed (${response.status}): ${errorText}`);

          // Don't retry on 4xx (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw err;
          }

          lastError = err;
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
            continue;
          }
          throw err;
        }

        return response.json() as Promise<T>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry on network errors and timeouts (not client errors)
        const isRetryable = lastError.name === 'TimeoutError' ||
          lastError.name === 'AbortError' ||
          lastError.message.includes('fetch failed') ||
          lastError.message.includes('ECONNREFUSED') ||
          lastError.message.includes('ECONNRESET');

        if (!isRetryable) {
          throw lastError;
        }

        if (attempt < MAX_ATTEMPTS - 1) {
          logger.warn(`EvolutionAPI attempt ${attempt + 2}/${MAX_ATTEMPTS} for ${method} ${path}`);
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }

    throw lastError!;
  }

  async ping(): Promise<void> {
    await fetch(`${this.baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: { apikey: this.apiKey },
      signal: AbortSignal.timeout(5_000),
    });
  }

  async createInstance(instanceName: string, webhookUrl: string): Promise<{ instance?: Record<string, unknown>; qrcode?: { base64?: string } }> {
    return this.request('POST', '/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: false,
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: true,
      webhook: {
        url: webhookUrl,
        byEvents: true,
        base64: true,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      },
    });
  }

  async connectInstance(instanceName: string): Promise<{ base64?: string }> {
    return this.request<{ base64?: string }>('GET', `/instance/connect/${instanceName}`);
  }

  async getInstanceStatus(instanceName: string): Promise<{ state: string }> {
    return this.request<{ state: string }>('GET', `/instance/connectionState/${instanceName}`);
  }

  async sendText(instanceName: string, to: string, text: string) {
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number: to,
      text,
    });
  }

  async getWebhook(instanceName: string): Promise<{ url?: string }> {
    return this.request<{ url?: string }>('GET', `/webhook/find/${instanceName}`);
  }

  async updateWebhook(instanceName: string, webhookUrl: string) {
    return this.request('POST', `/webhook/set/${instanceName}`, {
      url: webhookUrl,
      webhookByEvents: true,
      webhookBase64: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
      enabled: true,
    });
  }

  async deleteInstance(instanceName: string) {
    return this.request('DELETE', `/instance/delete/${instanceName}`);
  }
}
