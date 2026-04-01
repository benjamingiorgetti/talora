"use client";

import Link from "next/link";
import type { Conversation } from "@talora/shared";
import { ArrowRight } from "lucide-react";

function formatActivity(isoDate: string | null | undefined) {
  if (!isoDate) return "Sin actividad";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export function DashboardReviewPanel({
  reviewQueue,
}: {
  reviewQueue: Conversation[];
}) {
  return (
    <div className="rounded-xl border border-[#e2e4ec] bg-white">
      <div className="px-4 py-3 pb-2.5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Casos en revision
          </h3>
          <Link
            href="/whatsapp"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 hover:text-slate-700"
          >
            WhatsApp
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {reviewQueue.length > 0 ? (
          <div className="space-y-0">
            {reviewQueue.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 border-b border-[#f0f1f5] py-1.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-800">
                  {c.contact_name || c.phone_number}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {formatActivity(c.last_message_at)}
                </span>
                <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                  En pausa
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Todo al dia</p>
        )}
      </div>
    </div>
  );
}
