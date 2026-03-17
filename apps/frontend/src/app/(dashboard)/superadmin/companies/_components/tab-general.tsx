"use client";

import { useEffect, useState } from "react";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CompanyOverview } from "./types";
import { getEscalationDisplayText } from "./tab-general-state";

export function TabGeneral({
  company,
  onUpdated,
}: {
  company: CompanyOverview;
  onUpdated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [escalation, setEscalation] = useState(company.escalation_number ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setSaving(false);
    setEscalation(company.escalation_number ?? "");
  }, [company.id, company.escalation_number]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/companies/current/escalation-number", {
        escalation_number: escalation.trim() || null,
      });
      toast.success("Numero de escalacion actualizado");
      setEditing(false);
      onUpdated?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#ece2d5] bg-[#fcfaf6] p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Empresa
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {company.name}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Rubro
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {company.industry}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              WhatsApp
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {company.whatsapp_number || "No configurado"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Admins
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {company.admin_count} admin(s)
            </p>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Numero de escalacion
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editing ? (
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  value={escalation}
                  onChange={(e) => setEscalation(e.target.value)}
                  placeholder="5491112345678"
                  className="h-9 max-w-[220px] rounded-xl border-[#dde1ea] text-sm shadow-none"
                  maxLength={30}
                />
                <Button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="h-9 rounded-xl bg-slate-900 px-3 text-xs text-white hover:bg-slate-800"
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Guardar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setEscalation(company.escalation_number ?? "");
                  }}
                  className="h-9 rounded-xl px-3 text-xs text-slate-500"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-700">
                {getEscalationDisplayText(escalation, company.escalation_number)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
