"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import type { ClientAnalytics } from "@talora/shared";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function riskBadge(score: number) {
  if (score >= 70) return { bg: "bg-[#F8EAEF]", text: "text-[#9e3553]" };
  if (score >= 40) return { bg: "bg-[#F7EDDF]", text: "text-[#8b6d3f]" };
  return { bg: "bg-[#E8F6EB]", text: "text-[#2d5e3a]" };
}

/* ── Retention Summary (Level 4 — curated cards) ── */

export function DashboardRetentionSummary() {
  const { activeCompanyId } = useAuth();
  const { data: atRiskClients } = useSWR(
    companyScopedKey("/growth/at-risk?page=1&limit=10", activeCompanyId),
    companyScopedFetcher<ClientAnalytics[]>
  );

  const clients = (atRiskClients ?? []).slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-[1.1rem] font-semibold text-[#111318]">
          Clientes en riesgo
        </h3>
        <Link
          href="/growth"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#6B7280] hover:text-[#111318]"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-xl bg-[#E8F6EB] px-5 py-4">
          <p className="text-[13px] font-medium text-[#2d5e3a]">Sin clientes en riesgo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const badge = riskBadge(c.risk_score);
            return (
              <div
                key={c.client_id}
                className="relative rounded-xl border border-[#dde1ea] border-l-[2px] border-l-[#E2E4EC] bg-white px-4 py-3 transition-colors hover:bg-[#F8F9FC]"
              >
                <span className={`absolute top-3 right-3 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badge.bg} ${badge.text}`}>
                  {c.risk_score}
                </span>
                <p className="text-[13px] font-semibold text-[#111318] pr-10 truncate">
                  {c.client_name ?? "\u2014"}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#4B5563]">
                  <span>Ultimo: {formatDate(c.last_appointment_at)}</span>
                  {c.days_overdue != null && (
                    <span className="text-[#6B7280]">Vencido {c.days_overdue}d</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-[#6B7280]">
                  {c.total_appointments} turno{c.total_appointments !== 1 ? "s" : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Full At-Risk Table (Level 5 — below fold detail) ── */

export function DashboardAtRiskTable() {
  const { activeCompanyId } = useAuth();
  const { data: atRiskClients } = useSWR(
    companyScopedKey("/growth/at-risk?page=1&limit=10", activeCompanyId),
    companyScopedFetcher<ClientAnalytics[]>
  );

  const allClients = atRiskClients ?? [];
  const [expanded, setExpanded] = useState(false);
  const clients = expanded ? allClients : allClients.slice(0, 5);

  if (allClients.length === 0) return null;

  return (
    <div className="border-t border-[#dde1ea] pt-6 mt-2">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[#dde1ea] hover:bg-transparent">
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
              Cliente
            </TableHead>
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
              Telefono
            </TableHead>
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]">
              Ultimo turno
            </TableHead>
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] text-right">
              Vencido
            </TableHead>
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] text-right">
              Score
            </TableHead>
            <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B7280] text-right">
              Turnos
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => {
            const badge = riskBadge(c.risk_score);
            return (
              <TableRow key={c.client_id} className="border-b border-[#f0f1f5] hover:bg-[#F8F9FC]">
                <TableCell className="px-3 py-2 text-[12px] font-medium text-[#111318]">
                  {c.client_name ?? "\u2014"}
                </TableCell>
                <TableCell className="px-3 py-2 text-[12px] tabular-nums text-[#6B7280]">
                  {c.client_phone ?? "\u2014"}
                </TableCell>
                <TableCell className="px-3 py-2 text-[12px] text-[#6B7280]">
                  {formatDate(c.last_appointment_at)}
                </TableCell>
                <TableCell className="px-3 py-2 text-[12px] tabular-nums text-[#4B5563] text-right">
                  {c.days_overdue != null ? `${c.days_overdue}d` : "\u2014"}
                </TableCell>
                <TableCell className="px-3 py-2 text-right">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badge.bg} ${badge.text}`}>
                    {c.risk_score}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2 text-[12px] tabular-nums text-[#4B5563] text-right">
                  {c.total_appointments}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {allClients.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-[12px] font-medium text-[#4B5563] hover:text-[#111318] transition-colors"
        >
          {expanded ? (
            <>
              Mostrar menos
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Mostrar mas ({allClients.length - 5} restantes)
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
