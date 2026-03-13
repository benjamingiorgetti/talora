"use client";

import { type ChangeEvent, useDeferredValue, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { Professional, Service } from "@talora/shared";
import {
  BookOpenText,
  FileSpreadsheet,
  Loader2,
  PencilLine,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WorkspaceEmptyState, WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";
import { cn } from "@/lib/utils";

type ServiceDraft = {
  name: string;
  duration_minutes: string;
  price: string;
  description: string;
  professional_id: string;
};

type ImportRowPayload = {
  row_number: number;
  name: string;
  price: number | null;
  duration_minutes: number | null;
};

type ServiceImportPreviewItem = {
  row_number: number;
  action: "create" | "update" | "invalid";
  service_id: string | null;
  name: string;
  price: number | null;
  duration_minutes: number | null;
  error: string | null;
};

type ServiceImportPreviewResult = {
  summary: {
    total: number;
    create: number;
    update: number;
    invalid: number;
  };
  items: ServiceImportPreviewItem[];
};

const EMPTY_SERVICE: ServiceDraft = {
  name: "",
  duration_minutes: "60",
  price: "",
  description: "",
  professional_id: "all",
};

function parsePriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

function formatPrice(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t"] as const;
  return candidates.reduce(
    (best, candidate) => {
      const score = line.split(candidate).length;
      return score > best.score ? { delimiter: candidate, score } : best;
    },
    { delimiter: "," as "," | ";" | "\t", score: 0 }
  ).delimiter;
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === delimiter && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsvText(text: string): ImportRowPayload[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("El CSV necesita encabezados y al menos una fila.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader);
  const serviceIndex = headers.findIndex((header) => header === "servicio" || header === "service");
  const priceIndex = headers.findIndex((header) => header === "precio" || header === "price");
  const durationIndex = headers.findIndex((header) => header === "duracion" || header === "duration");

  if (serviceIndex === -1 || priceIndex === -1 || durationIndex === -1) {
    throw new Error("El CSV debe incluir las columnas servicio, precio y duracion.");
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line, delimiter);
    const durationValue = cells[durationIndex] ?? "";
    const digits = durationValue.replace(/[^\d]/g, "");
    const parsedDuration = digits ? Number.parseInt(digits, 10) : null;

    return {
      row_number: index + 2,
      name: (cells[serviceIndex] ?? "").trim(),
      price: parsePriceInput(cells[priceIndex] ?? ""),
      duration_minutes: Number.isFinite(parsedDuration) ? Math.round(parsedDuration as number) : null,
    };
  });
}

function getImportTone(action: ServiceImportPreviewItem["action"]) {
  if (action === "create") return "border-[#d6e5d0] bg-[#f4fbf0] text-[#365240]";
  if (action === "update") return "border-[#d9deef] bg-[#f5f7fe] text-[#415277]";
  return "border-[#efd7d7] bg-[#fff5f5] text-[#8a4f4f]";
}

function getImportLabel(action: ServiceImportPreviewItem["action"]) {
  if (action === "create") return "Alta";
  if (action === "update") return "Actualiza";
  return "Inválida";
}

export function ServicesSettingsPage() {
  const { activeCompanyId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(EMPTY_SERVICE);
  const [serviceEdits, setServiceEdits] = useState<Record<string, Partial<Service>>>({});
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applyingImport, setApplyingImport] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ServiceImportPreviewResult | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data: services, mutate: mutateServices } = useSWR(
    companyScopedKey("/services", activeCompanyId),
    companyScopedFetcher<Service[]>
  );
  const { data: professionals } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );

  const professionalMap = useMemo(() => {
    return new Map((professionals ?? []).map((professional) => [professional.id, professional.name]));
  }, [professionals]);

  const filteredServices = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return (services ?? []).filter((service) => {
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        String(service.price).includes(query) ||
        formatPrice(service.price).toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query)
      );
    });
  }, [deferredSearch, services]);

  const metrics = useMemo(() => {
    const rows = services ?? [];
    const activeRows = rows.filter((service) => service.is_active !== false);
    const averageDuration =
      rows.length > 0
        ? Math.round(rows.reduce((total, service) => total + service.duration_minutes, 0) / rows.length)
        : 0;

    return {
      total: rows.length,
      active: activeRows.length,
      priced: rows.length,
      averageDuration,
    };
  }, [services]);

  if (!services || !professionals) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const resetDraft = () => {
    setServiceDraft(EMPTY_SERVICE);
  };

  const handleCreateService = async () => {
    if (!serviceDraft.name.trim()) {
      toast.error("El nombre del servicio es obligatorio.");
      return;
    }
    const price = parsePriceInput(serviceDraft.price);
    if (price === null) {
      toast.error("El precio es obligatorio y debe ser un entero.");
      return;
    }

    setCreating(true);
    try {
      await api.post("/services", {
        name: serviceDraft.name.trim(),
        duration_minutes: Number(serviceDraft.duration_minutes) || 60,
        price,
        description: serviceDraft.description.trim(),
        professional_id: serviceDraft.professional_id === "all" ? null : serviceDraft.professional_id,
        is_active: true,
      });
      await mutateServices();
      resetDraft();
      toast.success("Servicio agregado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el servicio.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveService = async (service: Service) => {
    const draft = serviceEdits[service.id];
    if (!draft) return;

    setSavingId(service.id);
    try {
      await api.put(`/services/${service.id}`, draft);
      await mutateServices();
      setServiceEdits((current) => {
        const next = { ...current };
        delete next[service.id];
        return next;
      });
      toast.success("Servicio actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el servicio.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    setDeletingId(serviceId);
    try {
      await api.delete(`/services/${serviceId}`);
      await mutateServices();
      toast.success("Servicio eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el servicio.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewing(true);
    setPreview(null);
    setPreviewFileName(file.name);

    try {
      const text = await file.text();
      const rows = parseCsvText(text);
      const response = await api.post<{ data: ServiceImportPreviewResult }>("/services/import/preview", { rows });
      setPreview(response.data);
      toast.success("Preview listo.");
    } catch (error) {
      setPreview(null);
      setPreviewFileName(null);
      toast.error(error instanceof Error ? error.message : "No se pudo analizar el CSV.");
    } finally {
      setPreviewing(false);
      event.target.value = "";
    }
  };

  const handleApplyImport = async () => {
    if (!preview) return;

    setApplyingImport(true);
    try {
      const response = await api.post<{ data: { created: number; updated: number } }>("/services/import/apply", {
        items: preview.items,
      });
      await mutateServices();
      toast.success(`Importación aplicada. ${response.data.created} altas y ${response.data.updated} actualizaciones.`);
      setPreview(null);
      setPreviewFileName(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar la importación.");
    } finally {
      setApplyingImport(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-[#e4dccd] bg-[radial-gradient(circle_at_top_left,#fffefb_0%,#fcf8f1_48%,#f6efe4_100%)] p-5 shadow-[0_18px_36px_rgba(81,55,26,0.06)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <WorkspaceSectionHeader
            eyebrow="Configuración comercial"
            title="Servicios"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 rounded-2xl border-[#d8cdb8] bg-white px-4 hover:bg-[#f8f2e9]"
            >
              {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => mutateServices()}
              className="h-11 rounded-2xl border-[#d8cdb8] bg-white px-4 hover:bg-[#f8f2e9]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard label="Servicios cargados" value={metrics.total} icon={BookOpenText} tone="sand" />
          <WorkspaceMetricCard label="Activos" value={metrics.active} icon={PencilLine} tone="mint" />
          <WorkspaceMetricCard label="Con precio cargado" value={metrics.priced} icon={Receipt} tone="sky" />
          <WorkspaceMetricCard label="Duración promedio" value={`${metrics.averageDuration || 0} min`} icon={FileSpreadsheet} tone="lilac" />
        </div>

        <div className="mt-6 rounded-[24px] border border-dashed border-[#dbcdb8] bg-white/70 px-4 py-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Formato mínimo del CSV</p>
          <p className="mt-2">Usá encabezados `servicio`, `precio`, `duracion`. El preview no borra nada: solo propone altas y actualizaciones por nombre exacto.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImportFile}
        />
      </section>

      {preview ? (
        <Card className="rounded-[28px] border-[#e6dece] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Preview de importación</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {previewFileName ?? "Archivo listo para confirmar"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Revisá qué se crea, qué se actualiza y qué filas tienen errores antes de confirmar.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge className="rounded-full border-[#d9deef] bg-[#f5f7fe] px-3 py-1 text-[#415277]">
                  {preview.summary.create} altas
                </Badge>
                <Badge className="rounded-full border-[#d6e5d0] bg-[#f4fbf0] px-3 py-1 text-[#365240]">
                  {preview.summary.update} actualizaciones
                </Badge>
                <Badge className="rounded-full border-[#efd7d7] bg-[#fff5f5] px-3 py-1 text-[#8a4f4f]">
                  {preview.summary.invalid} inválidas
                </Badge>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {preview.items.map((item) => (
                <div
                  key={`${item.row_number}-${item.name}-${item.action}`}
                  className={cn("rounded-[22px] border px-4 py-4", getImportTone(item.action))}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border-current bg-white/70 px-3 py-1 text-current">
                          Fila {item.row_number}
                        </Badge>
                        <Badge className="rounded-full border-current bg-white/70 px-3 py-1 text-current">
                          {getImportLabel(item.action)}
                        </Badge>
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-900">{item.name || "Servicio sin nombre"}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.price !== null ? formatPrice(item.price) : "Sin precio"} · {item.duration_minutes ?? "Sin duración"} min
                      </p>
                      {item.error ? <p className="mt-2 text-sm text-[#9a4949]">{item.error}</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  setPreviewFileName(null);
                }}
                className="h-11 rounded-2xl border-[#dde1ea] bg-white px-4 hover:bg-[#f6f7fb]"
              >
                Cancelar preview
              </Button>
              <Button
                onClick={handleApplyImport}
                disabled={applyingImport || preview.summary.total === preview.summary.invalid}
                className="h-11 rounded-2xl px-4"
              >
                {applyingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Confirmar importación
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-[#e6dece] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
          <CardContent className="p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Alta manual</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Cargar un servicio</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Si el CSV te resuelve el arranque, esta parte te resuelve el ajuste fino.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label>Servicio</Label>
                <Input
                  value={serviceDraft.name}
                  onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 rounded-2xl border-[#e6dccb]"
                  placeholder="Consulta inicial"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Duración</Label>
                  <Input
                    value={serviceDraft.duration_minutes}
                    onChange={(event) => setServiceDraft((current) => ({ ...current, duration_minutes: event.target.value }))}
                    className="h-11 rounded-2xl border-[#e6dccb]"
                    placeholder="60"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Precio</Label>
                  <Input
                    value={serviceDraft.price}
                    onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))}
                    className="h-11 rounded-2xl border-[#e6dccb]"
                    placeholder="25000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Profesional</Label>
                <select
                  value={serviceDraft.professional_id}
                  onChange={(event) => setServiceDraft((current) => ({ ...current, professional_id: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-[#e6dccb] bg-white px-3 text-sm text-slate-700"
                >
                  <option value="all">Disponible para todos</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Descripción corta</Label>
                <Input
                  value={serviceDraft.description}
                  onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))}
                  className="h-11 rounded-2xl border-[#e6dccb]"
                  placeholder="Sirve para briefing y presupuesto."
                />
              </div>

              <Button onClick={handleCreateService} disabled={creating} className="h-11 w-full rounded-2xl">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Agregar servicio
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-[#e6dece] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Catálogo operativo</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Servicios activos para agenda y WhatsApp</h3>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 rounded-2xl border-[#e6dccb] pl-9"
                  placeholder="Buscar por nombre, precio o nota"
                />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {filteredServices.length === 0 ? (
                <WorkspaceEmptyState
                  title={services.length === 0 ? "Todavía no hay servicios cargados." : "No hay resultados para esa búsqueda."}
                  description={
                    services.length === 0
                      ? "Importá un CSV o crea el primer servicio manualmente para empezar a operar."
                      : "Probá con otro nombre o limpia el filtro para ver todo el catálogo."
                  }
                />
              ) : (
                filteredServices.map((service) => {
                  const draft = serviceEdits[service.id] ?? {};
                  const scopedProfessionalId =
                    (draft.professional_id as string | null | undefined) ?? service.professional_id ?? null;

                  return (
                    <div key={service.id} className="rounded-[24px] border border-[#ece3d6] bg-[linear-gradient(180deg,#fffdfa_0%,#faf6ef_100%)] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{service.name}</p>
                            <Badge className="rounded-full border-[#ddd9ef] bg-white px-3 py-1 text-[#55607a]">
                              {scopedProfessionalId ? professionalMap.get(scopedProfessionalId) ?? "Profesional" : "Todos"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {formatPrice(service.price)} · {service.duration_minutes} min
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleDeleteService(service.id)}
                            disabled={deletingId === service.id}
                            className="h-10 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            {deletingId === service.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            onClick={() => handleSaveService(service)}
                            disabled={savingId === service.id || !serviceEdits[service.id]}
                            className="h-10 rounded-2xl px-4"
                          >
                            {savingId === service.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Guardar
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_120px_140px]">
                        <Input
                          value={(draft.name as string | undefined) ?? service.name}
                          onChange={(event) =>
                            setServiceEdits((current) => ({
                              ...current,
                              [service.id]: { ...current[service.id], name: event.target.value },
                            }))
                          }
                          className="h-11 rounded-2xl border-[#e6dccb]"
                        />
                        <Input
                          value={String((draft.duration_minutes as number | undefined) ?? service.duration_minutes)}
                          onChange={(event) =>
                            setServiceEdits((current) => ({
                              ...current,
                              [service.id]: {
                                ...current[service.id],
                                duration_minutes: Number(event.target.value) || service.duration_minutes,
                              },
                            }))
                          }
                          className="h-11 rounded-2xl border-[#e6dccb]"
                        />
                        <Input
                          value={String((draft.price as number | undefined) ?? service.price)}
                          onChange={(event) =>
                            setServiceEdits((current) => ({
                              ...current,
                              [service.id]: { ...current[service.id], price: parsePriceInput(event.target.value) ?? service.price },
                            }))
                          }
                          className="h-11 rounded-2xl border-[#e6dccb]"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <select
                          value={scopedProfessionalId ?? "all"}
                          onChange={(event) =>
                            setServiceEdits((current) => ({
                              ...current,
                              [service.id]: {
                                ...current[service.id],
                                professional_id: event.target.value === "all" ? null : event.target.value,
                              },
                            }))
                          }
                          className="h-11 rounded-2xl border border-[#e6dccb] bg-white px-3 text-sm text-slate-700"
                        >
                          <option value="all">Disponible para todos</option>
                          {professionals.map((professional) => (
                            <option key={professional.id} value={professional.id}>
                              {professional.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={(draft.description as string | undefined) ?? service.description}
                          onChange={(event) =>
                            setServiceEdits((current) => ({
                              ...current,
                              [service.id]: { ...current[service.id], description: event.target.value },
                            }))
                          }
                          className="h-11 rounded-2xl border-[#e6dccb]"
                          placeholder="Descripción para el equipo"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
