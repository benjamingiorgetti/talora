"use client";

import type { SlotFillOpportunity, SlotFillCandidate } from "@talora/shared";
import { Send, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  same_service: { label: "Mismo servicio", color: "bg-blue-50 text-blue-700 border-blue-200" },
  same_professional: { label: "Mismo profesional", color: "bg-purple-50 text-purple-700 border-purple-200" },
  same_weekday: { label: "Mismo dia", color: "bg-green-50 text-green-700 border-green-200" },
  same_time_window: { label: "Misma franja", color: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue: { label: "Atrasado", color: "bg-red-50 text-red-700 border-red-200" },
};

function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }) + ", " + d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTimeRemaining(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "pasado";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return `en ${Math.ceil(diffMs / 60_000)}min`;
  if (hours < 24) return `en ${hours}h`;
  const days = Math.floor(hours / 24);
  return `en ${days}d`;
}

interface SlotFillOpportunityCardProps {
  opportunity: SlotFillOpportunity;
  onSend: (opportunityId: string, candidateId: string, clientName: string) => void;
  onDismiss: (opportunityId: string) => void;
}

export function SlotFillOpportunityCard({ opportunity, onSend, onDismiss }: SlotFillOpportunityCardProps) {
  const candidates = opportunity.candidates ?? [];

  return (
    <article className="min-w-[300px] max-w-[340px] shrink-0 rounded-[20px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-950">{opportunity.service_name}</p>
          {opportunity.professional_name && (
            <p className="text-xs text-slate-500">con {opportunity.professional_name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(opportunity.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="Descartar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Slot time */}
      <div className="mt-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs text-slate-600">{formatSlotTime(opportunity.slot_starts_at)}</span>
        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          {formatTimeRemaining(opportunity.slot_starts_at)}
        </span>
      </div>

      {/* Candidates */}
      <div className="mt-3 space-y-2">
        {candidates.map((candidate: SlotFillCandidate) => (
          <div
            key={candidate.id}
            className="rounded-xl border border-[#e6e7ec] bg-white p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {candidate.client_name ?? "Cliente"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {candidate.match_reasons.map((reason) => {
                    const info = REASON_LABELS[reason];
                    if (!info) return null;
                    return (
                      <span
                        key={reason}
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${info.color}`}
                      >
                        {info.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {candidate.score}pts
                </span>
                <Button
                  size="sm"
                  onClick={() => onSend(opportunity.id, candidate.id, candidate.client_name ?? "Cliente")}
                  className="h-7 rounded-lg bg-slate-900 px-2.5 text-[11px] text-white hover:bg-slate-800"
                >
                  <Send className="mr-1 h-3 w-3" />
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
