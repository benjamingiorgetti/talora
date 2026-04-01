"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Appointment, Conversation } from "@talora/shared";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type FeedEvent = {
  id: string;
  type: "confirmed" | "cancelled" | "rescheduled" | "paused";
  label: string;
  entity: string;
  timestamp: Date;
};

const dotColor: Record<FeedEvent["type"], string> = {
  confirmed: "bg-emerald-500",
  cancelled: "bg-rose-400",
  rescheduled: "bg-amber-400",
  paused: "bg-sky-400",
};

const typeLabel: Record<FeedEvent["type"], string> = {
  confirmed: "Turno confirmado",
  cancelled: "Turno cancelado",
  rescheduled: "Turno reprogramado",
  paused: "Necesita revision",
};

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

function buildEvents(
  appointments: WorkspaceAppointment[],
  conversations: Conversation[]
): FeedEvent[] {
  const events: FeedEvent[] = [];
  // Use 7 day window to ensure we always have something
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const a of appointments) {
    const ts = new Date(a.updated_at ?? a.created_at);
    if (ts.getTime() < cutoff) continue;

    const entity = a.client_name || "Cliente";

    if (a.status === "confirmed") {
      events.push({
        id: `appt-conf-${a.id}`,
        type: "confirmed",
        label: typeLabel.confirmed,
        entity,
        timestamp: ts,
      });
    } else if (a.status === "cancelled") {
      events.push({
        id: `appt-cancel-${a.id}`,
        type: "cancelled",
        label: typeLabel.cancelled,
        entity,
        timestamp: ts,
      });
    } else if (a.status === "rescheduled") {
      events.push({
        id: `appt-resch-${a.id}`,
        type: "rescheduled",
        label: typeLabel.rescheduled,
        entity,
        timestamp: ts,
      });
    }
  }

  for (const c of conversations) {
    if (!c.bot_paused) continue;
    const ts = new Date(c.last_message_at ?? c.created_at);
    if (ts.getTime() < cutoff) continue;

    events.push({
      id: `conv-paused-${c.id}`,
      type: "paused",
      label: typeLabel.paused,
      entity: c.contact_name || c.phone_number || "Contacto",
      timestamp: ts,
    });
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return events.slice(0, 5);
}

export function DashboardActivityFeed({
  appointments,
  conversations,
}: {
  appointments: WorkspaceAppointment[];
  conversations: Conversation[];
}) {
  const events = useMemo(
    () => buildEvents(appointments, conversations),
    [appointments, conversations]
  );

  // Empty: collapse to a tiny strip
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[#dde1ea] bg-[#f7f8fb] px-4 py-2">
        <span className="text-[11px] font-medium text-slate-500">
          Actividad reciente
        </span>
        <span className="text-[11px] text-slate-400">
          Sin movimiento reciente
        </span>
      </div>
    );
  }

  // With data: compact event feed
  return (
    <div className="rounded-2xl border border-[#dde1ea] bg-white">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#f0f1f5]">
        <h3 className="text-[13px] font-semibold text-slate-900">
          Actividad reciente
        </h3>
        <Link
          href="/whatsapp"
          className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          Ver todo
        </Link>
      </div>

      <div>
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center gap-2 border-b border-[#f0f1f5] px-4 py-1.5 last:border-b-0"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor[event.type]}`}
            />
            <span className="text-[12px] font-medium text-slate-700">
              {event.label}
            </span>
            <span className="text-[12px] text-slate-400">·</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-slate-500">
              {event.entity}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {formatRelative(event.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
