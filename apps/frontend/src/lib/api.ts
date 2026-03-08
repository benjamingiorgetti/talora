const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let isRedirecting = false;

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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 401) {
    // Don't redirect if this IS the login request — 401 means bad credentials
    if (path !== "/auth/login") {
      if (typeof window !== "undefined" && !isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem("token");
        window.location.href = "/login";
        // Reset flag after short delay in case redirect is blocked
        setTimeout(() => { isRedirecting = false; }, 2000);
      }
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
