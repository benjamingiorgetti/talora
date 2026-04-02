"use client";

import type { Service } from "@talora/shared";
import { Badge } from "@/components/ui/badge";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";

interface ServicesListProps {
  services: Service[];
  allServicesCount: number;
  professionalMap: Map<string, string>;
  onServiceClick: (service: Service) => void;
}

function formatPrice(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export function ServicesList({
  services,
  allServicesCount,
  professionalMap,
  onServiceClick,
}: ServicesListProps) {
  if (services.length === 0) {
    return (
      <WorkspaceEmptyState
        title={
          allServicesCount === 0
            ? "Todavia no hay servicios cargados."
            : "No hay resultados para esa busqueda."
        }
        description={
          allServicesCount === 0
            ? "Crea el primer servicio o importa un CSV para empezar."
            : "Proba con otro filtro o limpia la busqueda."
        }
        className="mx-auto max-w-2xl"
      />
    );
  }

  return (
    <div className="rounded-[28px] border border-[#e4dccd] bg-white overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#f0f1f5]">
            <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
              Nombre
            </th>
            <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
              Precio
            </th>
            <th className="hidden sm:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
              Duracion
            </th>
            <th className="hidden md:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
              Profesional
            </th>
            <th className="hidden md:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr
              key={service.id}
              onClick={() => onServiceClick(service)}
              className="border-b border-[#f0f1f5] last:border-0 hover:bg-[#faf6ef] transition-colors cursor-pointer"
            >
              <td className="px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 leading-snug">
                    {service.name}
                  </p>
                  {service.description && (
                    <p className="truncate text-xs text-slate-500 mt-0.5">
                      {service.description}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-5 py-3">
                <span className="text-sm font-medium text-slate-950">
                  {formatPrice(service.price)}
                </span>
              </td>
              <td className="hidden sm:table-cell px-5 py-3">
                <span className="text-sm text-slate-500">
                  {service.duration_minutes} min
                </span>
              </td>
              <td className="hidden md:table-cell px-5 py-3">
                <Badge
                  variant="secondary"
                  className="border-0 bg-[hsl(var(--surface-sky))] text-slate-700 text-xs font-medium"
                >
                  {service.professional_id
                    ? professionalMap.get(service.professional_id) ?? "Profesional"
                    : "Todos"}
                </Badge>
              </td>
              <td className="hidden md:table-cell px-5 py-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      service.is_active !== false ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  />
                  {service.is_active !== false ? "Activo" : "Inactivo"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
