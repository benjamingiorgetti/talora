"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Appointment, Professional } from "@talora/shared";
import { Card, CardContent } from "@/components/ui/card";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import {
  type CalendarDay,
  UNASSIGNED_PROFESSIONAL_ID,
  getAccentColor,
  hexToRgba,
} from "./utils";
import {
  AppointmentCardMobile,
  AppointmentRowDesktop,
} from "./appointment-row";

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

export function DayDetail({
  day,
  appointments,
  professionals,
  professionalMap,
  showAllProfessionals,
}: {
  day: CalendarDay;
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  professionalMap: Map<string, BoardProfessional>;
  showAllProfessionals: boolean;
}) {
  const dayAppointments = appointments.filter((a) => {
    const aKey =
      new Date(a.starts_at).getFullYear() +
      "-" +
      String(new Date(a.starts_at).getMonth() + 1).padStart(2, "0") +
      "-" +
      String(new Date(a.starts_at).getDate()).padStart(2, "0");
    return aKey === day.key;
  });

  return (
    <Card className="overflow-hidden rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[32px]">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-[#e6e7ec] bg-[#f7f8fc] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
              {day.meta}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">
              {day.label}
            </h3>
          </div>
          <span className="rounded-full border border-[#dde1ea] bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600">
            {dayAppointments.length === 0
              ? "Sin turnos"
              : dayAppointments.length === 1
                ? "1 turno"
                : `${dayAppointments.length} turnos`}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={day.key}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {dayAppointments.length === 0 ? (
              <div className="p-5 sm:p-6">
                <WorkspaceEmptyState
                  title="Dia libre"
                  description="No hay turnos agendados para este dia."
                />
              </div>
            ) : showAllProfessionals ? (
              <ProfessionalGroupedView
                appointments={dayAppointments}
                professionals={professionals}
                professionalMap={professionalMap}
              />
            ) : (
              <FlatTimelineView
                appointments={dayAppointments}
                professionals={professionals}
                professionalMap={professionalMap}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function ProfessionalGroupedView({
  appointments,
  professionals,
  professionalMap,
}: {
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  professionalMap: Map<string, BoardProfessional>;
}) {
  const grouped = new Map<string, AppointmentItem[]>();

  for (const a of appointments) {
    const profId =
      a.professional_id && professionalMap.has(a.professional_id)
        ? a.professional_id
        : UNASSIGNED_PROFESSIONAL_ID;
    const list = grouped.get(profId) ?? [];
    list.push(a);
    grouped.set(profId, list);
  }

  const orderedProfessionals = professionals.filter(
    (p) => grouped.has(p.id) && (grouped.get(p.id)?.length ?? 0) > 0
  );

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {orderedProfessionals.map((professional, index) => {
        const accent = getAccentColor(professional, index);
        const profAppointments = grouped.get(professional.id) ?? [];

        return (
          <motion.div
            key={professional.id}
            variants={staggerItem}
            className="border-b border-[#eceef3] last:border-b-0"
          >
            {/* Professional header */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"
              style={{
                background: `linear-gradient(90deg, ${hexToRgba(accent, 0.06)}, transparent)`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <div>
                  <span className="text-sm font-semibold text-slate-950">
                    {professional.name}
                  </span>
                  {professional.specialty && (
                    <span className="ml-2 text-xs text-slate-500">
                      {professional.specialty}
                    </span>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                {profAppointments.length === 1
                  ? "1 turno"
                  : `${profAppointments.length} turnos`}
              </span>
            </div>

            {/* Desktop rows */}
            <div className="hidden lg:block">
              {profAppointments.map((a) => (
                <AppointmentRowDesktop
                  key={a.id}
                  appointment={a}
                  accent={accent}
                />
              ))}
            </div>

            {/* Mobile cards */}
            <div className="space-y-2.5 px-4 pb-4 lg:hidden">
              {profAppointments.map((a) => (
                <AppointmentCardMobile
                  key={a.id}
                  appointment={a}
                  accent={accent}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function FlatTimelineView({
  appointments,
  professionals,
  professionalMap,
}: {
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  professionalMap: Map<string, BoardProfessional>;
}) {
  const sorted = [...appointments].sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const firstProf = professionals[0];
  const accent = firstProf
    ? getAccentColor(firstProf, 0)
    : "#667085";

  return (
    <>
      {/* Desktop rows */}
      <div className="hidden lg:block">
        {sorted.map((a) => (
          <AppointmentRowDesktop
            key={a.id}
            appointment={a}
            accent={accent}
          />
        ))}
      </div>

      {/* Mobile cards */}
      <div className="space-y-2.5 p-4 lg:hidden">
        {sorted.map((a) => {
          const prof = a.professional_id
            ? professionalMap.get(a.professional_id)
            : null;
          const cardAccent = prof
            ? getAccentColor(prof, 0)
            : accent;

          return (
            <AppointmentCardMobile
              key={a.id}
              appointment={a}
              accent={cardAccent}
              showProfessional
              professionalName={
                prof?.name ?? a.professional_name ?? "Sin asignar"
              }
            />
          );
        })}
      </div>
    </>
  );
}
