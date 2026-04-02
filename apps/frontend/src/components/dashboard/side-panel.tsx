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
    <div className="rounded-2xl border border-[#dde1ea] bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[1.1rem] font-semibold text-[#111318]">
            Casos en revision
          </h3>
          {reviewQueue.length > 0 && (
            <span className="rounded-full bg-[#ECEDF2] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#4B5563]">
              {reviewQueue.length}
            </span>
          )}
        </div>
        <Link
          href="/whatsapp"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#6B7280] hover:text-[#111318]"
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
              className="flex items-center justify-between gap-2 rounded-lg px-2 -mx-2 py-2 transition-colors hover:bg-[#F8F9FC]"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#E0D4FF]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#111318]">
                  {c.contact_name || c.phone_number}
                </span>
              </div>
              <span className="shrink-0 text-[11px] tabular-nums text-[#6B7280]">
                {formatActivity(c.last_message_at)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-[#F8F9FC] px-5 py-4">
          <div>
            <p className="text-[14px] font-semibold text-[#111318]">
              Todo al dia
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">
              El bot gestiona las conversaciones
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
