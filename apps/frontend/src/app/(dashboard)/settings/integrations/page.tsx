"use client";

import { CalendarTab } from "@/components/agent/calendar-tab";
import { RequireActiveCompany } from "@/components/role-guards";

export default function IntegrationsSettingsPage() {
  return (
    <RequireActiveCompany>
      <CalendarTab />
    </RequireActiveCompany>
  );
}
