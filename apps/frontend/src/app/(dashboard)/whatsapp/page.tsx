"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import WorkspaceWhatsAppPage from "@/app/(dashboard)/workspace/whatsapp/page";
import { RequireActiveCompany } from "@/components/role-guards";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function WhatsAppPage() {
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
      <WorkspaceWhatsAppPage />
    </RequireActiveCompany>
  );
}
