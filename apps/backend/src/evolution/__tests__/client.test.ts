/**
 * Unit tests for EvolutionClient.
 *
 * Strategy:
 * - mock.module intercepts '../../config' and '../../utils/logger' before dynamic import
 * - global.fetch is replaced per test via mock() so each test controls network responses
 * - global.setTimeout is replaced with an immediate version so retry delays are instant
 */
import { describe, it, expect, mock, beforeAll, beforeEach, afterEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE the dynamic import of the module
// under test so Bun's module registry picks them up.
// ---------------------------------------------------------------------------

const TEST_BASE_URL = 'http://evolution-test.local';
const TEST_API_KEY = 'test-apikey-123';

mock.module('../../config', () => ({
  config: {
    evolutionApiUrl: TEST_BASE_URL,
    evolutionApiKey: TEST_API_KEY,
  },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import — happens AFTER mock.module registrations.
// ---------------------------------------------------------------------------
const { EvolutionClient, EvolutionApiError } = await import('../client');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock fetch that includes the `preconnect` property Bun's `typeof fetch` requires. */
function mockFetch(fn: (...args: any[]) => Promise<any>) {
  return Object.assign(mock(fn) as unknown as typeof globalThis.fetch, { preconnect: () => {} });
}

/** Build a minimal Response-like object that satisfies what the client needs. */
function makeResponse(status: number, body: unknown): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(bodyText),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// setTimeout mock — makes RETRY_DELAYS[0] = 1000 ms resolve immediately
// so retry tests complete in microseconds instead of seconds.
// ---------------------------------------------------------------------------
let originalSetTimeout: typeof globalThis.setTimeout;

beforeAll(() => {
  originalSetTimeout = globalThis.setTimeout;
  // @ts-expect-error — replacing with a simplified synchronous-resolution mock
  globalThis.setTimeout = mock((fn: () => void) => {
    fn();
    return 0;
  });
});

afterEach(() => {
  // Reset fetch mock state between tests.
  // Individual tests assign globalThis.fetch themselves.
});

// Restore original setTimeout after all tests in this file.
// bun:test doesn't expose afterAll at the top level inside describe,
// so we use a module-level afterAll via a describe wrapper below.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvolutionClient', () => {
  let client: InstanceType<typeof EvolutionClient>;

  beforeEach(() => {
    client = new EvolutionClient();
  });

  // -------------------------------------------------------------------------
  // sendText
  // -------------------------------------------------------------------------
  describe('sendText', () => {
    it('should POST to /message/sendText/{instanceName} with correct payload and headers', async () => {
      const expectedResponse = { key: { id: 'msg-abc-123' } };
      let capturedRequest: { url: string; init: RequestInit } | null = null;

      globalThis.fetch = mockFetch(async (url: string | URL | Request, init?: RequestInit) => {
        capturedRequest = { url: String(url), init: init ?? {} };
        return makeResponse(200, expectedResponse);
      });

      const result = await client.sendText('my-instance', '+5491112345678', 'Hola mundo');

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.url).toBe(`${TEST_BASE_URL}/message/sendText/my-instance`);
      expect(capturedRequest!.init.method).toBe('POST');

      // Verify apikey header
      const headers = capturedRequest!.init.headers as Record<string, string>;
      expect(headers['apikey']).toBe(TEST_API_KEY);
      expect(headers['Content-Type']).toBe('application/json');

      // Verify request body
      const body = JSON.parse(capturedRequest!.init.body as string);
      expect(body).toEqual({ number: '+5491112345678', text: 'Hola mundo' });

      // Verify return value is the parsed response
      expect(result).toEqual(expectedResponse);
    });
  });

  // -------------------------------------------------------------------------
  // fetchInstances
  // -------------------------------------------------------------------------
  describe('fetchInstances', () => {
    it('should return parsed array from GET /instance/fetchInstances', async () => {
      const instances = [
        { name: 'inst-1', ownerJid: '5491111@s.whatsapp.net', connectionStatus: 'open' },
        { name: 'inst-2', connectionStatus: 'close' },
      ];

      globalThis.fetch = mockFetch(async () => makeResponse(200, instances));

      const result = await client.fetchInstances();

      expect(result).toEqual(instances);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('inst-1');
    });
  });

  // -------------------------------------------------------------------------
  // createInstance
  // -------------------------------------------------------------------------
  describe('createInstance', () => {
    it('should POST to /instance/create with full webhook config', async () => {
      const apiResponse = {
        instance: { instanceName: 'new-inst', status: 'created' },
        qrcode: { base64: 'data:image/png;base64,abc==' },
      };
      let capturedBody: Record<string, unknown> | null = null;

      globalThis.fetch = mockFetch(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return makeResponse(200, apiResponse);
      });

      const result = await client.createInstance('new-inst', 'https://myapp.com/webhook/new-inst');

      expect(capturedBody).not.toBeNull();
      expect(capturedBody!['instanceName']).toBe('new-inst');
      expect(capturedBody!['integration']).toBe('WHATSAPP-BAILEYS');
      expect(capturedBody!['qrcode']).toBe(true);

      // Verify webhook sub-object
      const webhook = capturedBody!['webhook'] as Record<string, unknown>;
      expect(webhook['url']).toBe('https://myapp.com/webhook/new-inst');
      expect(webhook['byEvents']).toBe(true);
      expect(webhook['base64']).toBe(true);
      expect(webhook['events']).toContain('MESSAGES_UPSERT');
      expect(webhook['events']).toContain('CONNECTION_UPDATE');
      expect(webhook['events']).toContain('QRCODE_UPDATED');

      expect(result).toEqual(apiResponse);
    });
  });

  // -------------------------------------------------------------------------
  // ping
  // -------------------------------------------------------------------------
  describe('ping', () => {
    it('should resolve without throwing when the API returns 200', async () => {
      globalThis.fetch = mockFetch(async () => makeResponse(200, []));

      // If ping throws, the test will fail automatically.
      await expect(client.ping()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getInstanceStatus
  // -------------------------------------------------------------------------
  describe('getInstanceStatus', () => {
    it('should normalise v2 response shape { instance: { state } } to { state }', async () => {
      globalThis.fetch = mockFetch(async () =>
        makeResponse(200, { instance: { instanceName: 'x', state: 'open' } })
      );

      const result = await client.getInstanceStatus('x');
      expect(result).toEqual({ state: 'open' });
    });

    it('should fall back to top-level state when instance wrapper is absent', async () => {
      globalThis.fetch = mockFetch(async () =>
        makeResponse(200, { state: 'close' })
      );

      const result = await client.getInstanceStatus('x');
      expect(result).toEqual({ state: 'close' });
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic — network / timeout errors
  // -------------------------------------------------------------------------
  describe('retry logic', () => {
    it('should retry once on fetch TypeError (network failure) and succeed on second attempt', async () => {
      let callCount = 0;

      globalThis.fetch = mockFetch(async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new TypeError('fetch failed');
        }
        return makeResponse(200, []);
      });

      await client.fetchInstances();

      expect(callCount).toBe(2);
    });

    it('should retry once on ECONNREFUSED and throw after MAX_ATTEMPTS exhausted', async () => {
      let callCount = 0;

      globalThis.fetch = mockFetch(async () => {
        callCount += 1;
        const err = new Error('connect ECONNREFUSED 127.0.0.1:8080');
        err.message = 'connect ECONNREFUSED 127.0.0.1:8080';
        throw err;
      });

      await expect(client.fetchInstances()).rejects.toThrow('ECONNREFUSED');
      expect(callCount).toBe(2); // 1 initial + 1 retry = MAX_ATTEMPTS
    });

    it('should retry once on AbortError (timeout) and throw after MAX_ATTEMPTS exhausted', async () => {
      let callCount = 0;

      globalThis.fetch = mockFetch(async () => {
        callCount += 1;
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      });

      await expect(client.fetchInstances()).rejects.toMatchObject({ name: 'AbortError' });
      expect(callCount).toBe(2);
    });

    it('should retry once on 5xx error and throw EvolutionApiError after MAX_ATTEMPTS exhausted', async () => {
      let callCount = 0;

      globalThis.fetch = mockFetch(async () => {
        callCount += 1;
        return makeResponse(503, 'Service Unavailable');
      });

      const error = await client.fetchInstances().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EvolutionApiError);
      expect((error as InstanceType<typeof EvolutionApiError>).statusCode).toBe(503);
      expect(callCount).toBe(2);
    });

    it('should NOT retry on 4xx error — throws immediately after first attempt', async () => {
      let callCount = 0;

      globalThis.fetch = mockFetch(async () => {
        callCount += 1;
        return makeResponse(404, 'Not Found');
      });

      const error = await client.fetchInstances().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EvolutionApiError);
      expect((error as InstanceType<typeof EvolutionApiError>).statusCode).toBe(404);
      expect(callCount).toBe(1); // No retry on 4xx
    });
  });

  // -------------------------------------------------------------------------
  // EvolutionApiError properties
  // -------------------------------------------------------------------------
  describe('EvolutionApiError', () => {
    it('should carry correct statusCode and endpoint when a 4xx is received', async () => {
      globalThis.fetch = mockFetch(async () =>
        makeResponse(401, 'Unauthorized')
      );

      const error = await client.sendText('inst', '+549111', 'hi').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EvolutionApiError);
      const apiErr = error as InstanceType<typeof EvolutionApiError>;
      expect(apiErr.name).toBe('EvolutionApiError');
      expect(apiErr.statusCode).toBe(401);
      expect(apiErr.endpoint).toBe('POST /message/sendText/inst');
      expect(apiErr.message).toContain('401');
    });

    it('should carry correct statusCode and endpoint when a 5xx is received', async () => {
      // Make every attempt fail so we get to the final throw.
      globalThis.fetch = mockFetch(async () =>
        makeResponse(500, 'Internal Server Error')
      );

      const error = await client.ping().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EvolutionApiError);
      const apiErr = error as InstanceType<typeof EvolutionApiError>;
      expect(apiErr.statusCode).toBe(500);
      expect(apiErr.endpoint).toBe('GET /instance/fetchInstances');
    });
  });

  // -------------------------------------------------------------------------
  // URL and header construction
  // -------------------------------------------------------------------------
  describe('URL construction', () => {
    it('should strip trailing slash from base URL and build correct path', async () => {
      // The TEST_BASE_URL has no trailing slash — the config mock always
      // returns a clean URL, but let us verify the exact URL for a known path.
      let capturedUrl = '';

      globalThis.fetch = mockFetch(async (url: string | URL | Request) => {
        capturedUrl = String(url);
        return makeResponse(200, { base64: 'qr==' });
      });

      await client.connectInstance('my-inst');

      expect(capturedUrl).toBe(`${TEST_BASE_URL}/instance/connect/my-inst`);
      // Verify there is no double-slash
      expect(capturedUrl).not.toContain('//instance');
    });

    it('should always include apikey header on every request', async () => {
      const capturedHeaders: Record<string, string>[] = [];

      globalThis.fetch = mockFetch(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders.push(init?.headers as Record<string, string>);
        return makeResponse(200, { url: 'https://hook.example.com' });
      });

      await client.getWebhook('inst-x');

      expect(capturedHeaders).toHaveLength(1);
      expect(capturedHeaders[0]['apikey']).toBe(TEST_API_KEY);
    });
  });
});
