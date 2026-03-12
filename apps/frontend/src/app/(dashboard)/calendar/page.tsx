"use client";

import WorkspaceCalendarPage from "@/app/(dashboard)/workspace/calendar/page";
import { RequireActiveCompany } from "@/components/role-guards";

export default function CalendarPage() {
  return (
    <RequireActiveCompany>
      <WorkspaceCalendarPage />
    </RequireActiveCompany>
  );
}
