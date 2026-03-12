"use client";

import WorkspaceClientsPage from "@/app/(dashboard)/workspace/clients/page";
import { RequireActiveCompany } from "@/components/role-guards";

export default function ClientsPage() {
  return (
    <RequireActiveCompany>
      <WorkspaceClientsPage />
    </RequireActiveCompany>
  );
}
