import { decodeJwtPayload } from "./jwt";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ACTIVE_COMPANY_STORAGE_KEY = "talora_active_company_id";

// Promise-based coordination: the first 401 creates the redirect promise,
// subsequent concurrent 401s await the same promise instead of competing.
let logoutPromise: Promise<void> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
}

function getActiveCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
}

const COMPANY_SCOPED_PREFIXES = [
  "/dashboard",
  "/instances",
  "/conversations",
  "/alerts",
  "/professionals",
  "/services",
  "/appointments",
  "/clients",
  "/companies/current",
  "/auth/google/status",
  "/auth/google/calendars",
  "/auth/google/connect",
  "/auth/google/disconnect",
  "/agent",
  "/company-settings",
  "/growth",
];

function shouldInjectCompanyScope(path: string): boolean {
  return COMPANY_SCOPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

function withCompanyScope(path: string, _method: string, body: unknown, token: string | null) {
  const role = getRoleFromToken(token);
  const activeCompanyId = getActiveCompanyId();

  if (role !== "superadmin" || !activeCompanyId || !shouldInjectCompanyScope(path)) {
    return { path, body };
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (!url.searchParams.has("company_id")) {
    url.searchParams.set("company_id", activeCompanyId);
  }

  return {
    path: `${url.pathname}${url.search}`,
    body,
  };
}

const GET_TIMEOUT_MS = 10_000;
const MUTATION_TIMEOUT_MS = 30_000;

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const method = (options.method ?? "GET").toUpperCase();
  const rawBody =
    typeof options.body === "string" && options.body.length > 0
      ? (JSON.parse(options.body) as unknown)
      : options.body;
  const scopedRequest = withCompanyScope(path, method, rawBody, token);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const timeoutMs = MUTATION_METHODS.has(method) ? MUTATION_TIMEOUT_MS : GET_TIMEOUT_MS;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${scopedRequest.path}`, {
      ...options,
      headers,
      body:
        method === "GET" || method === "DELETE"
          ? undefined
          : scopedRequest.body
          ? JSON.stringify(scopedRequest.body)
          : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // AbortError is thrown by AbortSignal.timeout() when the request times out.
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `La solicitud tardo demasiado (${timeoutMs / 1000}s). Verifica tu conexion e intenta de nuevo.`
      );
    }
    throw err;
  }

  if (res.status === 401) {
    // Don't redirect if this IS the login request — 401 means bad credentials.
    if (path !== "/auth/login" && typeof window !== "undefined") {
      if (!logoutPromise) {
        logoutPromise = (async () => {
          localStorage.removeItem("token");
          localStorage.removeItem("talora_superadmin_token");
          window.location.href = "/login";
        })();
      }
      await logoutPromise;
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function fetcher<T>(path: string): Promise<T> {
  const res = await api.get<{ data: T }>(path);
  return res.data;
}

export type CompanyScopedKey = readonly [path: string, activeCompanyId: string];

export function companyScopedKey(path: string, activeCompanyId: string | null | undefined): CompanyScopedKey | null {
  return activeCompanyId ? [path, activeCompanyId] : null;
}

export async function companyScopedFetcher<T>([path]: CompanyScopedKey): Promise<T> {
  return fetcher<T>(path);
}
