"use client";

import type { Professional, Service } from "@talora/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceEditDraft } from "./types";
import { parseCommaList, parsePriceInput } from "./types";

export function TabServicios({
  services,
  professionals,
  serviceDraft,
  setServiceDraft,
  serviceEdits,
  setServiceEdits,
  creatingService,
  onCreateService,
  onSaveService,
  onDeleteService,
}: {
  services: Service[] | undefined;
  professionals: Professional[] | undefined;
  serviceDraft: { name: string; aliases: string; duration_minutes: string; price: string; description: string; professional_id: string };
  setServiceDraft: (updater: (current: typeof serviceDraft) => typeof serviceDraft) => void;
  serviceEdits: Record<string, ServiceEditDraft>;
  setServiceEdits: (updater: (current: Record<string, ServiceEditDraft>) => Record<string, ServiceEditDraft>) => void;
  creatingService: boolean;
  onCreateService: () => void;
  onSaveService: (service: Service) => void;
  onDeleteService: (serviceId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Servicios</h4>

      {/* New service form */}
      <div className="rounded-[22px] border border-[#ece2d5] bg-[#fcfaf6] p-5">
        <p className="mb-3 text-sm font-semibold text-slate-950">Agregar servicio</p>
        <div className="grid gap-3">
          <Input value={serviceDraft.name} onChange={(event) => setServiceDraft((c) => ({ ...c, name: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Nombre del servicio" />
          <Input value={serviceDraft.aliases} onChange={(event) => setServiceDraft((c) => ({ ...c, aliases: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Aliases para el bot: corte, pelo, corte clasico" />
          <div className="grid gap-3 md:grid-cols-[120px_1fr]">
            <Input value={serviceDraft.duration_minutes} onChange={(event) => setServiceDraft((c) => ({ ...c, duration_minutes: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="60" />
            <Input value={serviceDraft.price} onChange={(event) => setServiceDraft((c) => ({ ...c, price: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="25000" />
          </div>
          <select
            value={serviceDraft.professional_id}
            onChange={(event) => setServiceDraft((c) => ({ ...c, professional_id: event.target.value }))}
            className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">Disponible para todos</option>
            {(professionals ?? []).map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name}
              </option>
            ))}
          </select>
          <Input value={serviceDraft.description} onChange={(event) => setServiceDraft((c) => ({ ...c, description: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Descripcion corta" />
          <Button disabled={creatingService} onClick={onCreateService} className="h-10 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
            <Plus className="mr-2 h-4 w-4" />
            {creatingService ? "Guardando..." : "Agregar servicio"}
          </Button>
        </div>
      </div>

      {/* Service list */}
      {(services ?? []).map((service) => {
        const draft = serviceEdits[service.id] ?? {};
        return (
          <div key={service.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4">
            <div className="grid gap-3">
              <Input
                value={(draft.name as string | undefined) ?? service.name}
                onChange={(event) => setServiceEdits((c) => ({ ...c, [service.id]: { ...c[service.id], name: event.target.value } }))}
                className="h-10 rounded-2xl border-[#eadfcd]"
              />
              <Input
                value={draft.aliases_text ?? (service.aliases ?? []).join(", ")}
                onChange={(event) => setServiceEdits((c) => ({
                  ...c,
                  [service.id]: {
                    ...c[service.id],
                    aliases_text: event.target.value,
                    aliases: parseCommaList(event.target.value),
                  },
                }))}
                className="h-10 rounded-2xl border-[#eadfcd]"
                placeholder="Aliases para el bot"
              />
              <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                <Input
                  value={String((draft.duration_minutes as number | undefined) ?? service.duration_minutes)}
                  onChange={(event) => setServiceEdits((c) => ({ ...c, [service.id]: { ...c[service.id], duration_minutes: Number(event.target.value) || 60 } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                />
                <Input
                  value={String((draft.price as number | undefined) ?? service.price)}
                  onChange={(event) => setServiceEdits((c) => ({ ...c, [service.id]: { ...c[service.id], price: parsePriceInput(event.target.value) ?? service.price } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                  placeholder="Precio"
                />
              </div>
              <select
                value={(draft.professional_id as string | undefined) ?? (service.professional_id ?? "all")}
                onChange={(event) => setServiceEdits((c) => ({ ...c, [service.id]: { ...c[service.id], professional_id: event.target.value === "all" ? null : event.target.value } }))}
                className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">Disponible para todos</option>
                {(professionals ?? []).map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
              <Input
                value={(draft.description as string | undefined) ?? service.description}
                onChange={(event) => setServiceEdits((c) => ({ ...c, [service.id]: { ...c[service.id], description: event.target.value } }))}
                className="h-10 rounded-2xl border-[#eadfcd]"
                placeholder="Descripcion"
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onDeleteService(service.id)} className="h-9 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
              <Button onClick={() => onSaveService(service)} className="h-9 rounded-2xl bg-[#17352d] px-3 hover:bg-[#21453a]">
                Guardar
              </Button>
            </div>
          </div>
        );
      })}
      {(services ?? []).length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[#e5d9c7] bg-white px-4 py-8 text-center text-sm text-slate-500">
          Todavia no hay servicios para esta cuenta.
        </div>
      )}
    </div>
  );
}
