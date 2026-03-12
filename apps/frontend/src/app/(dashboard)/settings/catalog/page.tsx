"use client";

import { ModulePlaceholderPage, RequireActiveCompany } from "@/components/role-guards";

export default function CatalogSettingsPage() {
  return (
    <RequireActiveCompany>
      <ModulePlaceholderPage
        eyebrow="Configuracion"
        title="Catalogo"
        description="Catalogo, servicios y estructura comercial del cliente quedan agrupados aca bajo la misma shell."
      />
    </RequireActiveCompany>
  );
}
