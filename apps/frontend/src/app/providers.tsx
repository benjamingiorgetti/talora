"use client";

import { AuthProvider } from "@/lib/auth";
import { Toaster } from "sonner";
import { SWRConfig } from "swr";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          // Never retry on 401 — the api.ts interceptor already handles redirect.
          if (error?.status === 401) return;
          // Never retry on 404 — resource doesn't exist.
          if (error?.status === 404) return;
          // Exponential backoff: 5s, 10s, 20s, 30s (cap) — retries indefinitely
          // so sections auto-recover when backend comes back.
          const delay = Math.min(5000 * Math.pow(2, retryCount), 30_000);
          setTimeout(() => revalidate({ retryCount }), delay);
        },
      }}
    >
    <AuthProvider>
      {children}
      <Toaster
        position="bottom-right"
        offset={24}
        toastOptions={{
          style: {
            background: "rgba(255,255,255,0.92)",
            border: "1px solid hsl(38 28% 86%)",
            borderRadius: "18px",
            padding: "16px",
            fontSize: "13px",
            color: "hsl(154 22% 16%)",
            boxShadow: "0 24px 60px rgba(88,70,40,0.15)",
          },
        }}
      />
    </AuthProvider>
    </SWRConfig>
  );
}
