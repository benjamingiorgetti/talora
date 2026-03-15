"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Professional } from "@talora/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WorkspaceErrorState } from "@/components/workspace/error-state";
import { WeekStrip, WeekStripMobile } from "./_components/week-strip";
import { DayDetail } from "./_components/day-detail";
import {
  UNASSIGNED_PROFESSIONAL_ID,
  buildCalendarDays,
  formatWeekRange,
  getAccentColor,
  getDateKey,
  getTodayIndex,
  hexToRgba,
  sameDay,
  startOfWeek,
} from "./_components/utils";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type BoardProfessional = {
  id: string;
  name: string;
  specialty?: string | null;
  color_hex: string | null;
  calendar_id?: string;
  is_active: boolean;
};

export default function WorkspaceCalendarPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const isProfessionalSession = session?.role === "professional";
  const sessionProfessionalId = session?.professionalId ?? null;

  // ── Week boundaries ──
  const weekStart = useMemo(() => {
    const current = startOfWeek(new Date());
    current.setDate(current.getDate() + offsetWeeks * 7);
    return current;
  }, [offsetWeeks]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const calendarDays = useMemo(() => buildCalendarDays(weekStart), [weekStart]);

  // ── Data fetching ──
  const { data: professionals, error: professionalsError } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );

  const {
    data: appointments,
    error: appointmentsError,
    mutate: mutateAppointments,
  } = useSWR<AppointmentItem[]>(
    companyScopedKey(
      `/appointments?from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(weekEnd.toISOString())}`,
      activeCompanyId
    ),
    companyScopedFetcher<AppointmentItem[]>
  );

  // ── Derived data ──
  const activeProfessionals = useMemo(
    () => (professionals ?? []).filter((p) => p.is_active !== false),
    [professionals]
  );

  const professionalMap = useMemo(
    () => new Map(activeProfessionals.map((p) => [p.id, p])),
    [activeProfessionals]
  );

  const sortedAppointments = useMemo(
    () =>
      [...(appointments ?? [])].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      ),
    [appointments]
  );

  const boardProfessionals = useMemo<BoardProfessional[]>(() => {
    const baseRows: BoardProfessional[] = activeProfessionals.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty ?? null,
      color_hex: p.color_hex,
      calendar_id: p.calendar_id,
      is_active: p.is_active,
    }));

    const hasUnassigned = sortedAppointments.some(
      (a) => !a.professional_id || !professionalMap.has(a.professional_id)
    );

    if (hasUnassigned && selectedProfessionalId === "all") {
      baseRows.push({
        id: UNASSIGNED_PROFESSIONAL_ID,
        name: "Sin asignar",
        specialty: "Revisar setup",
        color_hex: "#667085",
        is_active: true,
      });
    }

    if (selectedProfessionalId === "all") return baseRows;
    return baseRows.filter((p) => p.id === selectedProfessionalId);
  }, [
    activeProfessionals,
    professionalMap,
    selectedProfessionalId,
    sortedAppointments,
  ]);

  const visibleAppointments = useMemo(() => {
    if (selectedProfessionalId === "all") return sortedAppointments;
    return sortedAppointments.filter(
      (a) => a.professional_id === selectedProfessionalId
    );
  }, [selectedProfessionalId, sortedAppointments]);

  const appointmentCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of visibleAppointments) {
      const key = getDateKey(new Date(a.starts_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [visibleAppointments]);

  const maxDayCount = useMemo(() => {
    let max = 0;
    for (const count of appointmentCountByDay.values()) {
      if (count > max) max = count;
    }
    return max;
  }, [appointmentCountByDay]);

  const weekTotal = visibleAppointments.length;

  // ── Side effects ──
  useEffect(() => {
    if (pathname === "/workspace/calendar") {
      router.replace("/calendar");
    }
  }, [pathname, router]);

  useEffect(() => {
    setOffsetWeeks(0);
    setSelectedProfessionalId(sessionProfessionalId ?? "all");
  }, [activeCompanyId, sessionProfessionalId]);

  useEffect(() => {
    if (sessionProfessionalId) {
      setSelectedProfessionalId(sessionProfessionalId);
      return;
    }
    if (
      selectedProfessionalId !== "all" &&
      !activeProfessionals.some((p) => p.id === selectedProfessionalId)
    ) {
      setSelectedProfessionalId("all");
    }
  }, [activeProfessionals, selectedProfessionalId, sessionProfessionalId]);

  // Reset selected day when week changes
  useEffect(() => {
    setSelectedDayIndex(getTodayIndex(calendarDays));
  }, [calendarDays]);

  // ── Loading / error ──
  if (professionalsError || appointmentsError) {
    return (
      <WorkspaceErrorState
        className="min-h-[50vh]"
        onRetry={() => {
          void mutateAppointments();
        }}
      />
    );
  }

  if (!professionals && !appointments) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const selectedDay = calendarDays[selectedDayIndex] ?? calendarDays[0];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-5 lg:space-y-6">
      {/* ── Controls row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffsetWeeks((c) => c - 1)}
            className="h-10 w-10 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="inline-flex h-10 items-center rounded-2xl border border-muted bg-white px-4 text-sm text-foreground">
            {formatWeekRange(weekStart, weekEnd)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffsetWeeks((c) => c + 1)}
            className="h-10 w-10 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {weekTotal > 0 && (
            <span className="hidden text-sm text-slate-500 sm:inline-flex">
              {weekTotal === 1 ? "1 turno" : `${weekTotal} turnos`} esta semana
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isProfessionalSession && (
            <button
              type="button"
              onClick={() => setSelectedProfessionalId("all")}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                selectedProfessionalId === "all"
                  ? "border-[#1c1d22] bg-[#1c1d22] text-white"
                  : "border-[#dde1ea] bg-[#f7f8fc] text-slate-700 hover:border-[#cfd5e0] hover:bg-white"
              }`}
            >
              Todos
            </button>
          )}
          {activeProfessionals.map((professional, index) => {
            const accent = getAccentColor(professional, index);
            const isSelected = professional.id === selectedProfessionalId;
            return (
              <button
                key={professional.id}
                type="button"
                onClick={() => {
                  if (!isProfessionalSession) {
                    setSelectedProfessionalId(professional.id);
                  }
                }}
                disabled={isProfessionalSession}
                className="rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                style={{
                  borderColor: isSelected ? accent : hexToRgba(accent, 0.16),
                  background: isSelected ? accent : hexToRgba(accent, 0.09),
                  color: isSelected ? "#ffffff" : "#24323f",
                }}
              >
                {professional.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Week strip (desktop) ── */}
      <div className="hidden sm:block">
        <WeekStrip
          days={calendarDays}
          selectedIndex={selectedDayIndex}
          onSelect={setSelectedDayIndex}
          appointmentCountByDay={appointmentCountByDay}
          maxCount={maxDayCount}
        />
      </div>

      {/* ── Week strip (mobile) ── */}
      <div className="sm:hidden">
        <WeekStripMobile
          days={calendarDays}
          selectedIndex={selectedDayIndex}
          onSelect={setSelectedDayIndex}
          appointmentCountByDay={appointmentCountByDay}
        />
      </div>

      {/* ── Day detail ── */}
      <DayDetail
        day={selectedDay}
        appointments={visibleAppointments}
        professionals={boardProfessionals}
        professionalMap={professionalMap}
        showAllProfessionals={selectedProfessionalId === "all"}
      />
    </div>
  );
}
