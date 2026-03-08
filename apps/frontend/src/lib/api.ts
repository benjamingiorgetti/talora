const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Promise-based coordination: the first 401 creates the redirect promise,
// subsequent concurrent 401s await the same promise instead of competing.
let logoutPromise: Promise<void> | null = null;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

const GET_TIMEOUT_MS = 10_000;
const MUTATION_TIMEOUT_MS = 30_000;

const MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = (options.method ?? "GET").toUpperCase();
  const timeoutMs = MUTATION_METHODS.has(method) ? MUTATION_TIMEOUT_MS : GET_TIMEOUT_MS;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
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
