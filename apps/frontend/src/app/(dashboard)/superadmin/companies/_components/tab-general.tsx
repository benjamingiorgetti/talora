"use client";

import type { CompanyOverview } from "./types";

export function TabGeneral({ company }: { company: CompanyOverview }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#ece2d5] bg-[#fcfaf6] p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Empresa</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{company.name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Rubro</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{company.industry}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">WhatsApp</p>
            <p className="mt-1 text-sm text-slate-700">{company.whatsapp_number || "No configurado"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Admins</p>
            <p className="mt-1 text-sm text-slate-700">{company.admin_count} admin(s)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
