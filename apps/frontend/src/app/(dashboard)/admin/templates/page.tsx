"use client";

import { ModulePlaceholderPage, RequireAdminAccess } from "@/components/role-guards";

export default function AdminTemplatesPage() {
  return (
    <RequireAdminAccess description="Las plantillas administrativas del producto no forman parte del workspace cliente.">
      <ModulePlaceholderPage
        eyebrow="Administracion"
        title="Plantillas Admin"
        description="Aca vive la capa de plantillas internas de Talora para escalar setups, reglas y playbooks por rubro."
      />
    </RequireAdminAccess>
  );
}
