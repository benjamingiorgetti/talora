"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, CompanySettings, Professional } from "@talora/shared";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WorkspaceErrorState } from "@/components/workspace/error-state";
import { WeekStripMobile } from "./_components/week-strip";
import { DayDetail } from "./_components/day-detail";
import {
  CalendarHeader,
  type ViewMode,
} from "./_components/calendar-header";
import { DayView } from "./_components/day-view";
import { WeekView } from "./_components/week-view";
import { AppointmentDetailSheet } from "./_components/appointment-detail-sheet";
import {
  UNASSIGNED_PROFESSIONAL_ID,
  buildCalendarDays,
  formatDayLong,
  formatWeekRange,
  getAccentColor,
  getDateKey,
  getTodayIndex,
  gridHours,
  parseHourString,
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
  const [offsetDays, setOffsetDays] = useState(0);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("dia");
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentItem | null>(null);
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

  // ── Selected day for Día/Equipo views ──
  const selectedDay = useMemo(() => {
    if (viewMode === "dia" || viewMode === "equipo") {
      const base = new Date();
      base.setDate(base.getDate() + offsetDays);
      base.setHours(0, 0, 0, 0);
      return {
        date: base,
        key: getDateKey(base),
        label: "",
        weekday: "",
        dayNumber: base.getDate().toString(),
        meta: "",
      };
    }
    return calendarDays[selectedDayIndex] ?? calendarDays[0];
  }, [viewMode, offsetDays, calendarDays, selectedDayIndex]);

  // ── Data fetching ──
  const fetchFrom = useMemo(() => {
    if (viewMode === "dia" || viewMode === "equipo") {
      const d = new Date(selectedDay.date);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return weekStart;
  }, [viewMode, selectedDay.date, weekStart]);

  const fetchTo = useMemo(() => {
    if (viewMode === "dia" || viewMode === "equipo") {
      const d = new Date(selectedDay.date);
      d.setHours(23, 59, 59, 999);
      return d;
    }
    return weekEnd;
  }, [viewMode, selectedDay.date, weekEnd]);

  const { data: professionals, error: professionalsError } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>,
  );

  const {
    data: appointments,
    error: appointmentsError,
    mutate: mutateAppointments,
  } = useSWR<AppointmentItem[]>(
    companyScopedKey(
      `/appointments?from=${encodeURIComponent(fetchFrom.toISOString())}&to=${encodeURIComponent(fetchTo.toISOString())}`,
      activeCompanyId,
    ),
    companyScopedFetcher<AppointmentItem[]>,
  );

  const { data: companySettings } = useSWR(
    companyScopedKey("/company-settings", activeCompanyId),
    companyScopedFetcher<CompanySettings>,
  );

  const openingHour = companySettings?.opening_hour ?? "09:00";
  const closingHour = companySettings?.closing_hour ?? "18:00";
  const openingMinutes = parseHourString(openingHour);
  const closingMinutes = parseHourString(closingHour);
  const hours = useMemo(
    () => gridHours(openingHour, closingHour),
    [openingHour, closingHour],
  );

  // ── Derived data ──
  const activeProfessionals = useMemo(
    () => (professionals ?? []).filter((p) => p.is_active !== false),
    [professionals],
  );

  const professionalMap = useMemo(
    () => new Map(activeProfessionals.map((p) => [p.id, p])),
    [activeProfessionals],
  );

  const sortedAppointments = useMemo(
    () =>
      [...(appointments ?? [])].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [appointments],
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
      (a) => !a.professional_id || !professionalMap.has(a.professional_id),
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
      (a) => a.professional_id === selectedProfessionalId,
    );
  }, [selectedProfessionalId, sortedAppointments]);

  // Mobile: appointment counts for week strip
  const appointmentCountByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of visibleAppointments) {
      const key = getDateKey(new Date(a.starts_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [visibleAppointments]);

  // ── Navigation helpers ──
  function handlePrev() {
    if (viewMode === "semana") {
      setOffsetWeeks((c) => c - 1);
    } else {
      setOffsetDays((c) => c - 1);
    }
  }

  function handleNext() {
    if (viewMode === "semana") {
      setOffsetWeeks((c) => c + 1);
    } else {
      setOffsetDays((c) => c + 1);
    }
  }

  function handleToday() {
    if (viewMode === "semana") {
      setOffsetWeeks(0);
    } else {
      setOffsetDays(0);
    }
  }

  const dateLabel = useMemo(() => {
    if (viewMode === "semana") {
      return formatWeekRange(weekStart, weekEnd);
    }
    return formatDayLong(selectedDay.date);
  }, [viewMode, weekStart, weekEnd, selectedDay.date]);

  const isTodayVisible = useMemo(() => {
    if (viewMode === "semana") {
      return offsetWeeks === 0;
    }
    return offsetDays === 0;
  }, [viewMode, offsetWeeks, offsetDays]);

  // ── Side effects ──
  useEffect(() => {
    if (pathname === "/workspace/calendar") {
      router.replace("/calendar");
    }
  }, [pathname, router]);

  useEffect(() => {
    setOffsetWeeks(0);
    setOffsetDays(0);
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

  useEffect(() => {
    setSelectedDayIndex(getTodayIndex(calendarDays));
  }, [calendarDays]);

  // ── Get professional color for detail sheet ──
  const selectedAppointmentColor = useMemo(() => {
    if (!selectedAppointment?.professional_id) return "#667085";
    const prof = professionalMap.get(selectedAppointment.professional_id);
    if (!prof) return "#667085";
    const idx = activeProfessionals.findIndex(
      (p) => p.id === selectedAppointment.professional_id,
    );
    return getAccentColor(prof, idx);
  }, [selectedAppointment, professionalMap, activeProfessionals]);

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

  const weekTotal = visibleAppointments.length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto space-y-3 lg:space-y-3">
      {/* ── Desktop: Unified header ── */}
      <div className="hidden lg:block">
        <CalendarHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          dateLabel={dateLabel}
          isToday={isTodayVisible}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          professionals={activeProfessionals}
          selectedProfessionalId={selectedProfessionalId}
          onProfessionalChange={setSelectedProfessionalId}
          isProfessionalSession={isProfessionalSession}
          weekTotal={weekTotal}
        />
      </div>

      {/* ── Mobile: original controls + week strip + list ── */}
      <div className="lg:hidden space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                    borderColor: isSelected
                      ? accent
                      : `${accent}29`,
                    background: isSelected
                      ? accent
                      : `${accent}17`,
                    color: isSelected ? "#ffffff" : "#24323f",
                  }}
                >
                  {professional.name}
                </button>
              );
            })}
          </div>
        </div>

        <WeekStripMobile
          days={calendarDays}
          selectedIndex={selectedDayIndex}
          onSelect={setSelectedDayIndex}
          appointmentCountByDay={appointmentCountByDay}
        />

        <DayDetail
          day={calendarDays[selectedDayIndex] ?? calendarDays[0]}
          appointments={visibleAppointments}
          professionals={boardProfessionals}
          professionalMap={professionalMap}
          showAllProfessionals={selectedProfessionalId === "all"}
        />
      </div>

      {/* ── Desktop: Time grid views ── */}
      <div className="hidden lg:block">
        {(viewMode === "dia" || viewMode === "equipo") && (
          <DayView
            day={selectedDay}
            appointments={visibleAppointments}
            professionals={boardProfessionals}
            hours={hours}
            openingMinutes={openingMinutes}
            closingMinutes={closingMinutes}
            showAllProfessionals={
              viewMode === "equipo" || selectedProfessionalId === "all"
            }
            onAppointmentClick={setSelectedAppointment}
          />
        )}

        {viewMode === "semana" && (
          <WeekView
            days={calendarDays}
            appointments={visibleAppointments}
            professionals={activeProfessionals}
            selectedProfessionalId={selectedProfessionalId}
            hours={hours}
            openingMinutes={openingMinutes}
            closingMinutes={closingMinutes}
            onAppointmentClick={setSelectedAppointment}
          />
        )}
      </div>

      {/* ── Appointment detail sheet ── */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        professionalColor={selectedAppointmentColor}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
