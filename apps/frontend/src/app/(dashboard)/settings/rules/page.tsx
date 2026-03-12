"use client";

import { ModulePlaceholderPage, RequireActiveCompany } from "@/components/role-guards";

export default function RulesSettingsPage() {
  return (
    <RequireActiveCompany>
      <ModulePlaceholderPage
        eyebrow="Configuracion"
        title="Reglas"
        description="Las reglas visibles para el negocio viven aca. La parte sensible del prompt y las tools queda fuera del alcance del cliente."
      />
    </RequireActiveCompany>
  );
}
