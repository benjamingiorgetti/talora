"use client";

import { RequireActiveCompany } from "@/components/role-guards";
import { ProfessionalsSettingsPage } from "@/components/settings/professionals-settings-page";

export default function ProfessionalsPage() {
  return (
    <RequireActiveCompany>
      <ProfessionalsSettingsPage />
    </RequireActiveCompany>
  );
}
