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
