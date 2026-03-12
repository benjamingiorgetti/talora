"use client";

import { ModulePlaceholderPage, RequireActiveCompany } from "@/components/role-guards";

export default function LogisticsSettingsPage() {
  return (
    <RequireActiveCompany>
      <ModulePlaceholderPage
        eyebrow="Configuracion"
        title="Logistica"
        description="Este espacio queda preparado para reglas operativas del negocio que el cliente si puede gestionar desde su workspace."
      />
    </RequireActiveCompany>
  );
}
