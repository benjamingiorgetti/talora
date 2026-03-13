"use client";

import { RequireActiveCompany } from "@/components/role-guards";
import { ServicesSettingsPage } from "@/components/settings/services-settings-page";

export default function ServicesPage() {
  return (
    <RequireActiveCompany>
      <ServicesSettingsPage />
    </RequireActiveCompany>
  );
}
