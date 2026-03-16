"use client";

import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CompanyOverview } from "./types";
import { CompanyCard } from "./company-card";

export function CompanyList({
  companies,
  impersonatingId,
  onEdit,
  onImpersonate,
  onCreateOpen,
}: {
  companies: CompanyOverview[] | undefined;
  impersonatingId: string | null;
  onEdit: (companyId: string) => void;
  onImpersonate: (companyId: string) => void;
  onCreateOpen: () => void;
}) {
  if ((companies?.length ?? 0) === 0) {
    return (
      <Card className="rounded-[32px] border-[#ebe1d4] bg-white shadow-none">
        <CardContent className="px-8 py-14 text-center">
          <div className="mx-auto flex max-w-xl flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#17352d] text-white">
              <Building2 className="h-7 w-7" />
            </div>
            <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-slate-400">Primera cuenta</p>
            <h3 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              Crea la primera empresa para empezar
            </h3>
            <p className="mt-4 max-w-lg text-pretty text-sm leading-7 text-slate-500">
              Completa los datos basicos y despues segui con WhatsApp, equipo y servicios.
            </p>
            <Button onClick={onCreateOpen} className="mt-6 h-11 rounded-2xl bg-[#17352d] px-5 hover:bg-[#21453a]">
              <Plus className="mr-2 h-4 w-4" />
              Crear empresa
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(companies ?? []).map((company) => (
        <CompanyCard
          key={company.id}
          company={company}
          onEdit={() => onEdit(company.id)}
          onImpersonate={() => onImpersonate(company.id)}
          isImpersonating={impersonatingId === company.id}
        />
      ))}
    </div>
  );
}
