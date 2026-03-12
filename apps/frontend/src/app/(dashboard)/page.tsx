"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, resolveDefaultRoute } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardEntryPage() {
  const router = useRouter();
  const { activeCompanyId, isLoading, session } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      router.replace(resolveDefaultRoute(session, activeCompanyId));
    }
  }, [activeCompanyId, isLoading, router, session]);

  return <LoadingSpinner className="min-h-[70vh]" />;
}
