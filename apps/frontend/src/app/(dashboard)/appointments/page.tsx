"use client";

import WorkspaceAppointmentsPage from "@/app/(dashboard)/workspace/appointments/page";
import { RequireActiveCompany } from "@/components/role-guards";

export default function AppointmentsPage() {
  return (
    <RequireActiveCompany>
      <WorkspaceAppointmentsPage />
    </RequireActiveCompany>
  );
}
