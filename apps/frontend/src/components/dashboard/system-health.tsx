"use client";

import { cn } from "@/lib/utils";

function Indicator({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red";
}) {
  const dotColor =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "yellow"
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
      {label}
    </span>
  );
}

export function DashboardSystemHealth({
  botActivity,
  whatsappConnected,
  calendarConnected,
  isProfessional,
}: {
  botActivity: { label: string; tone: "green" | "yellow" | "red" };
  whatsappConnected: boolean;
  calendarConnected: boolean;
  isProfessional: boolean;
}) {
  if (isProfessional) return null;

  return (
    <div className="rounded-xl border border-[#dde1ea] bg-[#f7f8fb] px-4 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Estado del sistema
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <Indicator label={botActivity.label} tone={botActivity.tone} />
        <Indicator
          label={whatsappConnected ? "WhatsApp conectado" : "WhatsApp pendiente"}
          tone={whatsappConnected ? "green" : "yellow"}
        />
        <Indicator
          label={calendarConnected ? "Agenda conectada" : "Agenda pendiente"}
          tone={calendarConnected ? "green" : "yellow"}
        />
      </div>
    </div>
  );
}
