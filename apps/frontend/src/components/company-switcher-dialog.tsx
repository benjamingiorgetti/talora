"use client";

import { useEffect, useMemo, useState } from "react";
import type { Company } from "@talora/shared";
import { Building2, Check, Command, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CompanySwitcherDialogProps {
  companies: Company[];
  activeCompanyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (companyId: string) => void;
}

export function CompanySwitcherDialog({
  companies,
  activeCompanyId,
  open,
  onOpenChange,
  onSelect,
}: CompanySwitcherDialogProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredCompanies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return companies;

    return companies.filter((company) =>
      [company.name, company.industry, company.slug]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, [companies, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[28px] border-[#dfe4e8] bg-white p-0 shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
        <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
          <DialogTitle className="text-2xl font-semibold text-slate-950">Cambiar empresa</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Busca una compañía y cambia el contexto operativo sin salir del workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar empresa"
              className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-11 shadow-none"
            />
          </div>

          <div className="mt-4 space-y-2">
            {filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => {
                const active = company.id === activeCompanyId;

                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => onSelect(company.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        )}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{company.name}</p>
                        <p className="truncate text-sm text-slate-500">{company.industry}</p>
                      </div>
                    </div>

                    <div className="ml-4 flex items-center gap-2 text-xs text-slate-500">
                      {active ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-700" />
                          Activa
                        </>
                      ) : (
                        <>
                          <Command className="h-3.5 w-3.5" />
                          Cambiar
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">No encontramos empresas para esa búsqueda.</p>
                <p className="mt-2 text-sm text-slate-500">Prueba con otro nombre o vuelve a la lista completa.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
