"use client";

import { PromptEditorTab } from "@/components/agent/prompt-editor-tab";
import { ToolsTab } from "@/components/agent/tools-tab";
import { RequireActiveCompany, RequireAdminAccess } from "@/components/role-guards";

export default function AdminAiPage() {
  return (
    <RequireAdminAccess description="La parte tecnica del agente queda dentro de administracion y fuera de la vista del cliente.">
      <RequireActiveCompany title="Selecciona una empresa para editar IA" description="Prompt, tools y configuracion del agente dependen de una empresa activa incluso en modo superadmin.">
        <div className="space-y-6">
          <PromptEditorTab />
          <ToolsTab />
        </div>
      </RequireActiveCompany>
    </RequireAdminAccess>
  );
}
