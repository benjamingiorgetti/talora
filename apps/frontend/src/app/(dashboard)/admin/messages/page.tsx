"use client";

import { AlertsTab } from "@/components/agent/alerts-tab";
import { ConversationsTab } from "@/components/agent/conversations-tab";
import { RequireActiveCompany, RequireAdminAccess } from "@/components/role-guards";

export default function AdminMessagesPage() {
  return (
    <RequireAdminAccess description="Mensajes, conversaciones y alertas operativas del agente viven en administracion.">
      <RequireActiveCompany title="Selecciona una empresa para revisar mensajes" description="Las vistas de conversaciones y alertas cargan datos de una empresa puntual.">
        <div className="space-y-6">
          <ConversationsTab />
          <AlertsTab />
        </div>
      </RequireActiveCompany>
    </RequireAdminAccess>
  );
}
