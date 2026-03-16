"use client";

import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CompanyOverview } from "./types";

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-amber-400")} />
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  );
}

export function CompanyCard({
  company,
  onEdit,
  onImpersonate,
  isImpersonating,
}: {
  company: CompanyOverview;
  onEdit: () => void;
  onImpersonate: () => void;
  isImpersonating: boolean;
}) {
  return (
    <Card className="group rounded-[32px] border-[#ebe1d4] bg-white shadow-none transition-all hover:border-[#d4c8b5] hover:shadow-sm">
      <CardContent className="flex h-full flex-col p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold tracking-[-0.04em] text-slate-950">{company.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{company.industry}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2.5">
          <StatusDot
            ok={company.whatsapp_connected}
            label={company.whatsapp_connected ? "WhatsApp" : "WhatsApp pendiente"}
          />
          <StatusDot
            ok={company.calendar_connection_count > 0}
            label={`Calendar ${company.calendar_connection_count}/${company.professional_count}`}
          />
          <StatusDot
            ok={company.professional_count > 0}
            label={`${company.professional_count} profesional(es)`}
          />
          <StatusDot
            ok={company.service_count > 0}
            label={`${company.service_count} servicio(s)`}
          />
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onEdit}
            className="h-10 rounded-2xl border-[#e5d9c8] bg-white px-4 hover:bg-[#f7efe4]"
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            variant="ghost"
            disabled={!company.setup_ready || isImpersonating}
            onClick={onImpersonate}
            className="h-10 rounded-2xl px-3 text-slate-600 hover:bg-[#f7efe4] hover:text-slate-950"
          >
            {isImpersonating ? "Abriendo..." : "Ver como cliente"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
