"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Professional } from "@talora/shared";
import { AnimatePresence, motion } from "framer-motion";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WorkspaceErrorState } from "@/components/workspace/error-state";
import { fadeIn } from "@/lib/motion";
import { CalendarHeader } from "./_components/calendar-header";
import { CalendarDayView } from "./_components/calendar-day-view";
import { CalendarWeekView } from "./_components/calendar-week-view";
import { CalendarTeamView } from "./_components/calendar-team-view";
import { AppointmentDetailSheet } from "./_components/appointment-detail-sheet";
import {
  DEFAULT_BUSINESS_START,
  DEFAULT_BUSINESS_END,
} from "./_components/time-grid-constants";
import type {
  AppointmentItem,
  BoardProfessional,
  CalendarViewMode,
} from "./_components/calendar-shared-types";
import {
  UNASSIGNED_PROFESSIONAL_ID,
  buildCalendarDays,
  startOfWeek,
} from "./_components/utils";

export default function WorkspaceCalendarPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();

  // ── Core state ──
  const [view, setView] = useState<CalendarViewMode>("day");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const [detailAppointment, setDetailAppointment] =
    useState<AppointmentItem | null>(null);

  const isProfessionalSession = session?.role === "professional";
  const sessionProfessionalId = session?.professionalId ?? null;

  // ── Week boundaries (always fetch full week for smooth view switching) ──
  const weekStart = useMemo(() => startOfWeek(currentDate), [currentDate]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const calendarDays = useMemo(
    () => buildCalendarDays(weekStart),
    [weekStart]
  );

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

    if (
      hasUnassigned &&
      (selectedProfessionalId === "all" || view === "team")
    ) {
      baseRows.push({
        id: UNASSIGNED_PROFESSIONAL_ID,
        name: "Sin asignar",
        specialty: "Revisar setup",
        color_hex: "#667085",
        is_active: true,
      });
    }

    return baseRows;
  }, [
    activeProfessionals,
    professionalMap,
    selectedProfessionalId,
    sortedAppointments,
    view,
  ]);

  const visibleAppointments = useMemo(() => {
    if (selectedProfessionalId === "all" || view === "team")
      return sortedAppointments;
    return sortedAppointments.filter(
      (a) => a.professional_id === selectedProfessionalId
    );
  }, [selectedProfessionalId, sortedAppointments, view]);

  const weekTotal = visibleAppointments.length;

  const businessStart = DEFAULT_BUSINESS_START;
  const businessEnd = DEFAULT_BUSINESS_END;

  // ── Side effects ──
  useEffect(() => {
    if (pathname === "/workspace/calendar") {
      router.replace("/calendar");
    }
  }, [pathname, router]);

  useEffect(() => {
    setCurrentDate(new Date());
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

  // ── Handlers ──
  function handleDateChange(date: Date) {
    setCurrentDate(date);
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleAppointmentClick(appointment: AppointmentItem) {
    setDetailAppointment(appointment);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <CalendarHeader
        view={view}
        onViewChange={setView}
        currentDate={currentDate}
        onDateChange={handleDateChange}
        onToday={handleToday}
        professionals={boardProfessionals}
        selectedProfessionalId={selectedProfessionalId}
        onProfessionalChange={setSelectedProfessionalId}
        isProfessionalSession={isProfessionalSession}
        weekTotal={weekTotal}
      />

      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="h-full"
          >
            {view === "day" && (
              <CalendarDayView
                date={currentDate}
                appointments={visibleAppointments}
                professionals={boardProfessionals}
                selectedProfessionalId={selectedProfessionalId}
                businessStart={businessStart}
                businessEnd={businessEnd}
                onAppointmentClick={handleAppointmentClick}
              />
            )}
            {view === "week" && (
              <CalendarWeekView
                calendarDays={calendarDays}
                appointments={visibleAppointments}
                professionals={boardProfessionals}
                professionalMap={professionalMap}
                businessStart={businessStart}
                businessEnd={businessEnd}
                onAppointmentClick={handleAppointmentClick}
              />
            )}
            {view === "team" && (
              <CalendarTeamView
                date={currentDate}
                appointments={sortedAppointments}
                professionals={boardProfessionals}
                businessStart={businessStart}
                businessEnd={businessEnd}
                onAppointmentClick={handleAppointmentClick}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AppointmentDetailSheet
        appointment={detailAppointment}
        professionals={boardProfessionals}
        professionalMap={professionalMap}
        open={!!detailAppointment}
        onOpenChange={(open) => {
          if (!open) setDetailAppointment(null);
        }}
      />
    </div>
  );
}
