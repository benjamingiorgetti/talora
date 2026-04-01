"use client";

import useSWR from "swr";
import Link from "next/link";
import type { ClientAnalytics } from "@talora/shared";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function riskBadge(score: number) {
  if (score >= 70) return { bg: "bg-[#f8eaef]", text: "text-[#9e3553]" };
  if (score >= 40) return { bg: "bg-[#f7eddf]", text: "text-[#8b6d3f]" };
  return { bg: "bg-[#e8f6eb]", text: "text-[#2d5e3a]" };
}

export function DashboardAtRiskTable() {
  const { activeCompanyId } = useAuth();
  const { data: atRiskClients } = useSWR(
    companyScopedKey("/growth/at-risk?page=1&limit=10", activeCompanyId),
    companyScopedFetcher<ClientAnalytics[]>
  );

  const clients = atRiskClients ?? [];

  return (
    <div className="border-t border-[#dde1ea] pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Clientes en riesgo
        </h3>
        <Link
          href="/growth"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {clients.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-1">
          Sin clientes en riesgo
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#e6e7ee] hover:bg-transparent">
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Cliente
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Telefono
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                Ultimo turno
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 text-right">
                Vencido
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 text-right">
                Score
              </TableHead>
              <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 text-right">
                Turnos
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => {
              const badge = riskBadge(c.risk_score);
              return (
                <TableRow key={c.client_id} className="border-b border-[#f0f1f5] hover:bg-[#f5f6fa]">
                  <TableCell className="px-3 py-2 text-[13px] font-medium text-slate-900">
                    {c.client_name ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[12px] tabular-nums text-slate-500">
                    {c.client_phone ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[12px] text-slate-500">
                    {formatDate(c.last_appointment_at)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[12px] tabular-nums text-slate-600 text-right">
                    {c.days_overdue != null ? `${c.days_overdue}d` : "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badge.bg} ${badge.text}`}>
                      {c.risk_score}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-[12px] tabular-nums text-slate-600 text-right">
                    {c.total_appointments}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
