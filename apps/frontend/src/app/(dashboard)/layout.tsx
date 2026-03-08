"use client";

import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />;
  }

  if (!token) return null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-6 max-w-7xl mx-auto animate-in fade-in-0 duration-150">
          {children}
        </main>
      </div>
    </ErrorBoundary>
  );
}
