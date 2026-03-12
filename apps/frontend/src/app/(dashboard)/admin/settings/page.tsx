"use client";

import { ModulePlaceholderPage, RequireAdminAccess } from "@/components/role-guards";

export default function AdminSettingsPage() {
  return (
    <RequireAdminAccess description="Ajustes globales y configuracion interna quedan reservados para Talora.">
      <ModulePlaceholderPage
        eyebrow="Administracion"
        title="Ajustes globales de Talora"
        description="Este modulo queda preparado para overrides globales, configuracion interna y criterios operativos de Talora."
      />
    </RequireAdminAccess>
  );
}
