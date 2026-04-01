"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function DashboardReactivationStrip({
  reactivables,
  messagesSent,
  deliveryRate,
  href,
}: {
  reactivables: number;
  messagesSent: number;
  deliveryRate: number;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dde1ea] bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#f0f1f5]">
        <h3 className="text-sm font-semibold text-slate-900">Reactivacion</h3>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Ver detalle
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[#f0f1f5]">
        <div className="px-3 py-2.5 text-center">
          <p className="text-[11px] font-medium text-slate-500">Reactivables</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-950">
            {reactivables}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[11px] font-medium text-slate-500">Mensajes enviados</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-950">
            {messagesSent}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-[11px] font-medium text-slate-500">Entrega WhatsApp</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-950">
            {Math.round(deliveryRate)}%
          </p>
        </div>
      </div>

      {reactivables > 0 && (
        <div className="border-t border-[#f0f1f5] px-4 py-2">
          <p className="text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">{reactivables}</span> clientes ya deberian volver
          </p>
        </div>
      )}
    </div>
  );
}
