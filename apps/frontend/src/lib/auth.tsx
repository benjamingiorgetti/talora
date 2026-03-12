"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";
import { decodeJwtPayload } from "./jwt";
import { pickPreferredCompanyId } from "./company";

export type AppRole = "superadmin" | "admin_empresa" | "professional";

export interface AuthSession {
  userId: string | null;
  fullName: string | null;
  email: string | null;
  role: AppRole;
  companyId: string | null;
  professionalId: string | null;
  companyName: string | null;
  isImpersonating: boolean;
}

type StoredSuperadminContext = {
  companyId: string | null;
  shouldRedirectToCompanies: boolean;
};

type CompanyChoice = { id: string; slug?: string | null };

interface AuthContextType {
  token: string | null;
  session: AuthSession | null;
  activeCompanyId: string | null;
  setActiveCompanyId: (companyId: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  impersonate: (companyId: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SUPERADMIN_TOKEN_STORAGE_KEY = "talora_superadmin_token";
const ACTIVE_COMPANY_STORAGE_KEY = "talora_active_company_id";
const ZERO_COMPANIES_STORAGE_KEY = "talora_superadmin_zero_companies";

function isAppRole(value: unknown): value is AppRole {
  return value === "superadmin" || value === "admin_empresa" || value === "professional";
}

function parseSession(token: string): AuthSession | null {
  const payload = decodeJwtPayload(token);
  const rawRole = payload?.role;
  if (!isAppRole(rawRole)) {
    return null;
  }

  const userId =
    typeof payload?.userId === "string"
      ? payload.userId
      : typeof payload?.user_id === "string"
      ? payload.user_id
      : null;
  const email = typeof payload?.email === "string" ? payload.email : null;

  if (!userId || !email) {
    return null;
  }

  return {
    userId,
    fullName:
      typeof payload?.fullName === "string"
        ? payload.fullName
        : typeof payload?.full_name === "string"
        ? payload.full_name
        : null,
    email,
    role: rawRole,
    companyId:
      typeof payload?.companyId === "string"
        ? payload.companyId
        : typeof payload?.company_id === "string"
        ? payload.company_id
        : null,
    professionalId:
      typeof payload?.professionalId === "string"
        ? payload.professionalId
        : typeof payload?.professional_id === "string"
        ? payload.professional_id
        : null,
    companyName:
      typeof payload?.companyName === "string"
        ? payload.companyName
        : typeof payload?.company_name === "string"
        ? payload.company_name
        : null,
    isImpersonating: Boolean(payload?.impersonatedBy || payload?.impersonating),
  };
}

function readStoredSuperadminContext(): StoredSuperadminContext {
  if (typeof window === "undefined") {
    return { companyId: null, shouldRedirectToCompanies: false };
  }

  return {
    companyId: localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY),
    shouldRedirectToCompanies: localStorage.getItem(ZERO_COMPANIES_STORAGE_KEY) === "1",
  };
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
  localStorage.removeItem(ZERO_COMPANIES_STORAGE_KEY);
}

async function resolveFallbackCompanyId(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/companies`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const body = (await response.json()) as { data?: CompanyChoice[] };
    return pickPreferredCompanyId(body.data ?? null);
  } catch {
    return null;
  }
}

export function resolveDefaultRoute(session: AuthSession | null, activeCompanyId?: string | null): string {
  if (!session) return "/login";
  if (session.role === "admin_empresa") return "/dashboard";
  if (session.role === "professional") return "/clients";
  return activeCompanyId ? "/dashboard" : "/admin/companies";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeCompanyIdState, setActiveCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  // Keep a stable ref so event handlers can read current token without stale closure.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const setActiveCompanyId = useCallback((companyId: string | null) => {
    setActiveCompanyIdState(companyId);

    if (typeof window === "undefined") return;

    if (companyId) {
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId);
      localStorage.removeItem(ZERO_COMPANIES_STORAGE_KEY);
    } else {
      localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }, []);

  const syncSuperadminContext = useCallback(
    async (currentToken: string, nextSession: AuthSession, preferredCompanyId?: string | null) => {
      if (nextSession.role !== "superadmin") {
        return nextSession.companyId;
      }

      const nextActiveCompanyId = await resolveFallbackCompanyId(currentToken);
      const resolvedCompanyId = preferredCompanyId && nextActiveCompanyId === null ? preferredCompanyId : nextActiveCompanyId;

      if (typeof window !== "undefined") {
        if (resolvedCompanyId) {
          localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, resolvedCompanyId);
          localStorage.removeItem(ZERO_COMPANIES_STORAGE_KEY);
        } else {
          localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
          localStorage.setItem(ZERO_COMPANIES_STORAGE_KEY, "1");
        }
      }

      setActiveCompanyIdState(resolvedCompanyId);
      return resolvedCompanyId;
    },
    []
  );

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      const nextSession = parseSession(stored);
      if (!nextSession) {
        clearStoredAuth();
        setToken(null);
        setSession(null);
        setActiveCompanyIdState(null);
        if (pathname !== "/login") {
          redirectToLogin();
        }
        setIsLoading(false);
        return;
      }
      const storedContext = readStoredSuperadminContext();
      const nextActiveCompanyId =
        nextSession.role === "admin_empresa" || nextSession.role === "professional"
          ? nextSession.companyId
          : storedContext.companyId;

      setToken(stored);
      setSession(nextSession);
      setActiveCompanyIdState(nextActiveCompanyId);

      if (nextSession.role === "admin_empresa" || nextSession.role === "professional") {
        if (nextSession.companyId) {
          localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, nextSession.companyId);
        } else {
          localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
        }
      }

      if (
        nextSession.role === "superadmin" &&
        storedContext.shouldRedirectToCompanies &&
        !pathname.startsWith("/admin/companies")
      ) {
        router.replace("/admin/companies");
      } else if (pathname === "/login") {
        router.replace(resolveDefaultRoute(nextSession, nextActiveCompanyId));
      }
    } else if (pathname !== "/login") {
      redirectToLogin();
    }
    setIsLoading(false);
  }, [pathname, redirectToLogin, router]);

  useEffect(() => {
    if (!token || !session || session.role !== "superadmin") return;
    if (activeCompanyIdState) return;

    const storedContext = readStoredSuperadminContext();
    let cancelled = false;

    void syncSuperadminContext(token, session, storedContext.companyId).then((resolvedCompanyId) => {
      if (cancelled || !resolvedCompanyId) return;
      if (pathname === "/login") {
        router.replace(resolveDefaultRoute(session, resolvedCompanyId));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeCompanyIdState, pathname, router, session, syncSuperadminContext, token]);

  // Sync auth state when api.ts removes the token from localStorage (e.g. on 401).
  // storage events only fire in OTHER tabs; focus events catch the same-tab case.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "token" && !e.newValue) {
        setToken(null);
        setSession(null);
        setActiveCompanyIdState(null);
      }

      if (e.key === ACTIVE_COMPANY_STORAGE_KEY) {
        setActiveCompanyIdState(e.newValue);
      }
    };

    const handleFocus = () => {
      const current = localStorage.getItem("token");
      if (!current && tokenRef.current) {
        setToken(null);
        setSession(null);
        setActiveCompanyIdState(null);
        redirectToLogin();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, [redirectToLogin]);

    const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ data: { token: string } }>("/auth/login", { email, password });
      const token = res.data.token;
      const nextSession = parseSession(token);
      if (!nextSession) {
        clearStoredAuth();
        throw new Error("La sesión recibida es inválida. Volvé a iniciar sesión.");
      }
      const storedContext = readStoredSuperadminContext();
      let nextActiveCompanyId =
        nextSession.role === "admin_empresa" || nextSession.role === "professional"
          ? nextSession.companyId
          : storedContext.companyId;
      if (nextSession.role === "superadmin" && !nextActiveCompanyId) {
        nextActiveCompanyId = await syncSuperadminContext(token, nextSession, storedContext.companyId);
      }
      localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
      localStorage.setItem("token", token);
      if (nextSession.role !== "superadmin" && nextActiveCompanyId) {
        localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, nextActiveCompanyId);
        localStorage.removeItem(ZERO_COMPANIES_STORAGE_KEY);
      } else if (nextSession.role !== "superadmin") {
        localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
      }
      setToken(token);
      setSession(nextSession);
      setActiveCompanyIdState(nextActiveCompanyId);
      router.replace(resolveDefaultRoute(nextSession, nextActiveCompanyId));
    },
    [router, syncSuperadminContext]
  );

  const impersonate = useCallback(
    async (companyId: string) => {
      if (tokenRef.current && session?.role === "superadmin") {
        localStorage.setItem(SUPERADMIN_TOKEN_STORAGE_KEY, tokenRef.current);
      }
      const res = await api.post<{ data: { token: string } }>(`/auth/impersonate/${companyId}`);
      const nextToken = res.data.token;
      const nextSession = parseSession(nextToken);
      if (!nextSession) {
        clearStoredAuth();
        throw new Error("La sesión de impersonación es inválida. Volvé a iniciar sesión.");
      }
      localStorage.setItem("token", nextToken);
      localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId);
      setToken(nextToken);
      setSession(nextSession);
      setActiveCompanyIdState(companyId);
      router.replace(resolveDefaultRoute(nextSession, companyId));
    },
    [router, session?.role]
  );

  const exitImpersonation = useCallback(async () => {
    const currentActiveCompanyId = session?.companyId ?? localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);

    try {
      const res = await api.post<{ data: { token: string } }>("/auth/restore");
      const nextToken = res.data.token;
      const nextSession = parseSession(nextToken);
      if (!nextSession) {
        clearStoredAuth();
        throw new Error("No se pudo restaurar una sesión válida de superadmin.");
      }
      localStorage.setItem("token", nextToken);
      localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
      if (currentActiveCompanyId) {
        localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, currentActiveCompanyId);
      } else {
        localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
      }
      setToken(nextToken);
      setSession(nextSession);
      setActiveCompanyIdState(currentActiveCompanyId);
      router.replace(resolveDefaultRoute(nextSession, currentActiveCompanyId));
      return;
    } catch (error) {
      const originalToken = localStorage.getItem(SUPERADMIN_TOKEN_STORAGE_KEY);
      if (!originalToken) {
        throw error instanceof Error ? error : new Error("No hay una sesion de Talora para restaurar.");
      }

      const nextSession = parseSession(originalToken);
      if (!nextSession) {
        clearStoredAuth();
        throw new Error("La sesión guardada de Talora es inválida. Volvé a iniciar sesión.");
      }
      localStorage.setItem("token", originalToken);
      localStorage.removeItem(SUPERADMIN_TOKEN_STORAGE_KEY);
      if (currentActiveCompanyId) {
        localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, currentActiveCompanyId);
      } else {
        localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
      }
      setToken(originalToken);
      setSession(nextSession);
      setActiveCompanyIdState(currentActiveCompanyId);
      router.replace(resolveDefaultRoute(nextSession, currentActiveCompanyId));
    }
  }, [router, session?.companyId]);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setSession(null);
    setActiveCompanyIdState(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        token,
        session,
        activeCompanyId:
          session?.role === "admin_empresa" || session?.role === "professional"
            ? session.companyId
            : activeCompanyIdState,
        setActiveCompanyId,
        login,
        impersonate,
        exitImpersonation,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
