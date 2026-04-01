"use client";

type KpiItem = {
  label: string;
  value: string | number;
  accent: string;
  emphasis?: boolean;
  delta?: string;
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
      accent: "#9b8afb",
    },
    {
      label: "Automatizacion",
      value: `${automationRate}%`,
      accent: "#6bc98a",
    },
    {
      label: "Pendientes",
      value: formatMetric(pausedCount),
      accent: "#d4a96a",
      emphasis: pausedCount > 0,
    },
    {
      label: "En riesgo",
      value: formatMetric(atRiskCount),
      accent: "#d47b8a",
      emphasis: atRiskCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 py-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[#e2e4ec] bg-white px-4 py-3"
          style={{ borderLeftWidth: 3, borderLeftColor: item.emphasis ? item.accent : "#e2e4ec" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
            {item.label}
          </p>
          <p
            className="mt-0.5 text-2xl font-bold tabular-nums leading-tight"
            style={{ color: item.emphasis ? item.accent : "#0f172a" }}
          >
            {item.value}
          </p>
          {item.delta && (
            <p className="mt-0.5 text-[11px] text-slate-400">
              {item.delta}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
