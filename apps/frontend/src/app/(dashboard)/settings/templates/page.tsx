"use client";

import { ModulePlaceholderPage, RequireActiveCompany } from "@/components/role-guards";

export default function TemplatesSettingsPage() {
  return (
    <RequireActiveCompany>
      <ModulePlaceholderPage
        eyebrow="Configuracion"
        title="Plantillas"
        description="Las plantillas visibles para el cliente se gestionan desde esta seccion dentro de la misma experiencia compartida."
      />
    </RequireActiveCompany>
  );
}
