"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import WorkspaceDashboardPage from "@/app/(dashboard)/workspace/page";
import { RequireActiveCompany } from "@/components/role-guards";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (session?.role === "professional") {
      router.replace("/clients");
    }
  }, [router, session?.role]);

  if (session?.role === "professional") {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  return (
    <RequireActiveCompany>
      <WorkspaceDashboardPage />
    </RequireActiveCompany>
  );
}
