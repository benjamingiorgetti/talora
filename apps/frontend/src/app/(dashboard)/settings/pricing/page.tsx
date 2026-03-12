"use client";

import { ModulePlaceholderPage, RequireActiveCompany } from "@/components/role-guards";

export default function PricingSettingsPage() {
  return (
    <RequireActiveCompany>
      <ModulePlaceholderPage
        eyebrow="Configuracion"
        title="Listas de precios"
        description="Este modulo queda listo para manejar precios y referencias comerciales por empresa, sin tocar la parte tecnica del agente."
      />
    </RequireActiveCompany>
  );
}
