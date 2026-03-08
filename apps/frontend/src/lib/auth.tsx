"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "./api";

interface AuthContextType {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      setToken(stored);
    } else if (pathname !== "/login") {
      router.replace("/login");
    }
    setIsLoading(false);
  }, [pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ data: { token: string } }>("/auth/login", { email, password });
      const token = res.data.token;
      localStorage.setItem("token", token);
      setToken(token);
      router.replace("/");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
