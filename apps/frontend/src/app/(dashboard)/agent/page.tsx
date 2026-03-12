"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function AgentLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/ai");
  }, [router]);

  return <LoadingSpinner className="min-h-[70vh]" />;
}
