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
          // Stop retrying after 3 attempts for all other errors.
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 5000);
        },
      }}
    >
    <AuthProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "'Nunito', sans-serif",
            borderRadius: "16px",
            padding: "16px",
            fontSize: "15px",
          },
        }}
        richColors
      />
    </AuthProvider>
    </SWRConfig>
  );
}
