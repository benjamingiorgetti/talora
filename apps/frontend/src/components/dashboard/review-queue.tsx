"use client";

import Link from "next/link";
import type { Conversation } from "@talora/shared";
import { ArrowRight } from "lucide-react";

function formatActivity(isoDate: string | null | undefined) {
  if (!isoDate) return "Sin actividad";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  return `Hace ${Math.floor(diffH / 24)} d`;
}

export function DashboardReviewQueue({
  conversations,
}: {
  conversations: Conversation[];
}) {
  return (
    <div className="rounded-2xl border border-[#dde1ea] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f1f5]">
        <h3 className="text-sm font-semibold text-slate-900">
          Casos en revision
        </h3>
        <Link
          href="/whatsapp"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Abrir WhatsApp
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Rows */}
      {conversations.length > 0 ? (
        <div>
          {conversations.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-[#f0f1f5] px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {c.contact_name || c.phone_number}
                </p>
              </div>

              <span className="shrink-0 text-xs text-slate-400">
                {formatActivity(c.last_message_at)}
              </span>

              <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                En pausa
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-xs text-slate-500">Todo al dia</p>
          <Link
            href="/whatsapp"
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Ver conversaciones
          </Link>
        </div>
      )}
    </div>
  );
}
