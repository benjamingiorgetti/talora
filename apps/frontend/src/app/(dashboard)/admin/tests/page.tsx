"use client";

import { TestChatPanel } from "@/components/agent/test-chat-panel";
import { Card, CardContent } from "@/components/ui/card";
import { RequireActiveCompany, RequireAdminAccess } from "@/components/role-guards";

export default function AdminTestsPage() {
  return (
    <RequireAdminAccess description="Los tests del agente quedan disponibles solo para Talora.">
      <RequireActiveCompany title="Selecciona una empresa para correr tests" description="La prueba del agente necesita contexto real de empresa para no devolver errores vacios.">
        <Card className="rounded-[28px] border-[#ece2d5] bg-white shadow-none">
          <CardContent className="p-6">
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Tests</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Probar el agente sin exponer la consola tecnica al cliente.
              </h2>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-[#ece2d5]">
              <TestChatPanel promptSavedAt={null} />
            </div>
          </CardContent>
        </Card>
      </RequireActiveCompany>
    </RequireAdminAccess>
  );
}
