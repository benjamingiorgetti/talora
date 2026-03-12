"use client";

import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />;
  }

  if (!token) {
    return <LoadingSpinner className="min-h-screen" />;
  }

  return (
    <ErrorBoundary>
      <AppShell>{children}</AppShell>
    </ErrorBoundary>
  );
}
