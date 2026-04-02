"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

type KpiItem = {
  label: string;
  value: string | number;
  microcopy: string;
  primary?: boolean;
  emphasis?: boolean;
  dot?: string;
};

function formatMetric(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

export function DashboardKpiStrip({
  todayCount,
  automationRate,
  pausedCount,
  atRiskCount,
  isProfessional,
}: {
  todayCount: number;
  automationRate: number;
  pausedCount: number;
  atRiskCount: number;
  isProfessional: boolean;
}) {
  const items: KpiItem[] = [
    {
      label: isProfessional ? "Mis turnos" : "Turnos hoy",
      value: formatMetric(todayCount),
      microcopy: "confirmados en agenda",
      primary: true,
    },
    {
      label: "Automatizacion",
      value: `${automationRate}%`,
      microcopy: "gestionados por bot",
    },
    {
      label: "Pendientes",
      value: formatMetric(pausedCount),
      microcopy: "conversaciones en pausa",
      emphasis: pausedCount > 0,
      dot: "#F7EDDF",
    },
    {
      label: "En riesgo",
      value: formatMetric(atRiskCount),
      microcopy: "requieren seguimiento",
      emphasis: atRiskCount > 0,
      dot: "#F8EAEF",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.6fr_1fr_1fr_1fr] py-1"
    >
      {items.map((item) => (
        <motion.div
          key={item.label}
          variants={staggerItem}
          className={
            item.primary
              ? "col-span-2 sm:col-span-1 rounded-2xl border-l-[3px] border-l-[#1C1D22] bg-[#F5F6FA] px-5 py-4"
              : "rounded-xl border border-[#dde1ea] bg-white px-4 py-2.5"
          }
        >
          <p className={
            item.primary
              ? "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]"
              : "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4B5563]"
          }>
            {item.label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {item.emphasis && item.dot && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.dot }}
              />
            )}
            <p
              className={
                item.primary
                  ? "font-display text-[3.5rem] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[#111318]"
                  : "text-[1.5rem] font-bold leading-none tabular-nums text-[#111318]"
              }
            >
              {item.value}
            </p>
          </div>
          <p className={
            item.primary
              ? "mt-2 text-[12px] text-[#6B7280]"
              : "mt-1 text-[11px] text-[#6B7280]"
          }>
            {item.microcopy}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
