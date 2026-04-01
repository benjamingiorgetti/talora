"use client";

import { useCallback, useState } from "react";
import type { Appointment } from "@talora/shared";

export type TimeRange = "today" | "7d" | "30d";

function isSameDay(dateStr: string, target: Date) {
  const d = new Date(dateStr);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function isWithinDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d >= cutoff;
}

export function useDashboardFilters() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [professionalId, setProfessionalId] = useState<string>("all");

  const filterAppointments = useCallback(
    (appointments: Appointment[]) => {
      let filtered = appointments.filter((a) => a.status !== "cancelled");

      // Time filter
      if (timeRange === "today") {
        const today = new Date();
        filtered = filtered.filter((a) => isSameDay(a.starts_at, today));
      } else if (timeRange === "7d") {
        filtered = filtered.filter((a) => isWithinDays(a.starts_at, 7));
      } else if (timeRange === "30d") {
        filtered = filtered.filter((a) => isWithinDays(a.starts_at, 30));
      }

      // Professional filter
      if (professionalId !== "all") {
        filtered = filtered.filter((a) => a.professional_id === professionalId);
      }

      return filtered.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
    },
    [timeRange, professionalId]
  );

  return {
    timeRange,
    setTimeRange,
    professionalId,
    setProfessionalId,
    filterAppointments,
  };
}
