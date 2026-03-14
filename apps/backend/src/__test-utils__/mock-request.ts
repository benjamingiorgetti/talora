import { mock } from 'bun:test';

type MockResponse = {
  status: ReturnType<typeof mock>;
  json: ReturnType<typeof mock>;
  send: ReturnType<typeof mock>;
  headersSent: boolean;
  _statusCode: number;
  _body: unknown;
};

export function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    query: {},
    params: {},
    body: {},
    user: undefined,
    get: mock((name: string) => {
      const headers = (overrides.headers || {}) as Record<string, string>;
      return headers[name.toLowerCase()];
    }),
    ...overrides,
  } as any;
}

export function createMockRes(): MockResponse {
  const res: Partial<MockResponse> = {
    headersSent: false,
    _statusCode: 200,
    _body: undefined,
  };
  res.json = mock((body: unknown) => {
    res._body = body;
    return res;
  });
  res.send = mock((body: unknown) => {
    res._body = body;
    return res;
  });
  res.status = mock((code: number) => {
    res._statusCode = code;
    return res;
  });
  return res as MockResponse;
}

export function createMockNext() {
  return mock(() => {});
}
