import { config } from '../config';
import { logger } from '../utils/logger';

/** Total number of attempts (1 initial + retries). RETRY_DELAYS length must be >= MAX_ATTEMPTS - 1. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAYS = [1000];
const REQUEST_TIMEOUT = 5_000;

export class EvolutionApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

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
          const err = new EvolutionApiError(`EvolutionAPI ${method} ${path} failed (${response.status}): ${errorText}`, response.status, `${method} ${path}`);

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
    await this.request<unknown>('GET', '/instance/fetchInstances');
  }

  async fetchInstances(): Promise<Array<{ name: string; ownerJid?: string; connectionStatus?: string }>> {
    return this.request<Array<{ name: string; ownerJid?: string; connectionStatus?: string }>>('GET', '/instance/fetchInstances');
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
    // v2.3.7 returns { instance: { instanceName, state } } instead of { state }
    const res = await this.request<{ instance?: { state?: string }; state?: string }>('GET', `/instance/connectionState/${instanceName}`);
    const state = res.instance?.state ?? res.state ?? 'unknown';
    return { state };
  }

  async getInstanceInfo(instanceName: string): Promise<{ ownerJid?: string; connectionStatus?: string }> {
    const instances = await this.request<Array<{ name: string; ownerJid?: string; connectionStatus?: string }>>('GET', '/instance/fetchInstances');
    const instance = instances.find(i => i.name === instanceName);
    return { ownerJid: instance?.ownerJid, connectionStatus: instance?.connectionStatus };
  }

  async sendText(instanceName: string, to: string, text: string) {
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number: to,
      text,
    });
  }

  async sendReaction(
    instanceName: string,
    key: { id: string; remoteJid: string; fromMe?: boolean },
    reaction: string
  ) {
    return this.request('POST', `/message/sendReaction/${instanceName}`, {
      key,
      reaction,
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
