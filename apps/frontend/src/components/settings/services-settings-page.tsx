"use client";

import { type ChangeEvent, useDeferredValue, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import type { Professional, Service } from "@talora/shared";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageEntrance } from "@/components/ui/page-entrance";
import { ServicesFilters } from "@/components/settings/services-filters";
import { ServicesList } from "@/components/settings/services-list";
import { ServiceEditorSheet, type ServiceFormData } from "@/components/settings/service-editor-sheet";

/* ── CSV types ────────────────────────────────────────────────── */

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

/* ── CSV helpers ──────────────────────────────────────────────── */

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
  return "Invalida";
}

/* ── Main page ────────────────────────────────────────────────── */

export function ServicesSettingsPage() {
  const { activeCompanyId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* filters */
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc" | "duration">("name");

  /* sheet */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [editingService, setEditingService] = useState<Service | null>(null);

  /* csv */
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [preview, setPreview] = useState<ServiceImportPreviewResult | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applyingImport, setApplyingImport] = useState(false);

  /* data */
  const { data: services, mutate: mutateServices } = useSWR(
    companyScopedKey("/services", activeCompanyId),
    companyScopedFetcher<Service[]>
  );
  const { data: professionals } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );

  const professionalMap = useMemo(() => {
    return new Map((professionals ?? []).map((p) => [p.id, p.name]));
  }, [professionals]);

  const filteredAndSortedServices = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    let result = (services ?? []).filter((s) => {
      if (query) {
        const matchesSearch =
          s.name.toLowerCase().includes(query) ||
          String(s.price).includes(query) ||
          formatPrice(s.price).toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter === "active" && s.is_active === false) return false;
      if (statusFilter === "inactive" && s.is_active !== false) return false;
      if (professionalFilter !== "all" && s.professional_id !== professionalFilter) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "es");
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "duration":
          return a.duration_minutes - b.duration_minutes;
        default:
          return 0;
      }
    });

    return result;
  }, [deferredSearch, services, statusFilter, professionalFilter, sortBy]);

  if (!services || !professionals) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  /* sheet handlers */
  const openCreateSheet = () => {
    setSheetMode("create");
    setEditingService(null);
    setSheetOpen(true);
  };

  const openEditSheet = (service: Service) => {
    setSheetMode("edit");
    setEditingService(service);
    setSheetOpen(true);
  };

  const handleSaveService = async (data: ServiceFormData) => {
    try {
      if (sheetMode === "create") {
        await api.post("/services", { ...data, is_active: true });
        await mutateServices();
        toast.success("Servicio agregado.");
      } else if (editingService) {
        await api.put(`/services/${editingService.id}`, data);
        await mutateServices();
        toast.success("Servicio actualizado.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el servicio.");
      throw error;
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await api.delete(`/services/${serviceId}`);
      await mutateServices();
      toast.success("Servicio eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el servicio.");
      throw error;
    }
  };

  /* csv handlers */
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
      setCsvDialogOpen(true);
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
      toast.success(`Importacion aplicada. ${response.data.created} altas y ${response.data.updated} actualizaciones.`);
      setPreview(null);
      setPreviewFileName(null);
      setCsvDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar la importacion.");
    } finally {
      setApplyingImport(false);
    }
  };

  return (
    <PageEntrance className="min-h-0 flex-1 overflow-y-auto space-y-5 lg:space-y-6">
      <ServicesFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        professionalFilter={professionalFilter}
        onProfessionalFilterChange={setProfessionalFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        professionals={professionals}
        onCreateClick={openCreateSheet}
        onImportClick={() => fileInputRef.current?.click()}
        isPreviewing={previewing}
      />

      <ServicesList
        services={filteredAndSortedServices}
        allServicesCount={services.length}
        professionalMap={professionalMap}
        onServiceClick={openEditSheet}
      />

      <ServiceEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        service={editingService}
        professionals={professionals}
        onSave={handleSaveService}
        onDelete={handleDeleteService}
      />

      {/* CSV import dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="rounded-[28px] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Preview de importacion</p>
              <DialogTitle className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {previewFileName ?? "Archivo listo para confirmar"}
              </DialogTitle>
              <p className="text-sm leading-6 text-slate-500">
                Revisa que se crea, que se actualiza y que filas tienen errores antes de confirmar.
              </p>
              {preview && (
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border-[#d9deef] bg-[#f5f7fe] px-3 py-1 text-[#415277]">
                    {preview.summary.create} altas
                  </Badge>
                  <Badge className="rounded-full border-[#d6e5d0] bg-[#f4fbf0] px-3 py-1 text-[#365240]">
                    {preview.summary.update} actualizaciones
                  </Badge>
                  <Badge className="rounded-full border-[#efd7d7] bg-[#fff5f5] px-3 py-1 text-[#8a4f4f]">
                    {preview.summary.invalid} invalidas
                  </Badge>
                </div>
              )}
            </div>
          </DialogHeader>

          {preview && (
            <div className="space-y-3">
              {preview.items.map((item) => (
                <div
                  key={`${item.row_number}-${item.name}-${item.action}`}
                  className={`rounded-[22px] border px-4 py-4 ${getImportTone(item.action)}`}
                >
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
                    {item.price !== null ? formatPrice(item.price) : "Sin precio"} · {item.duration_minutes ?? "Sin duracion"} min
                  </p>
                  {item.error ? <p className="mt-2 text-sm text-[#9a4949]">{item.error}</p> : null}
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
                setPreviewFileName(null);
                setCsvDialogOpen(false);
              }}
              className="h-11 rounded-2xl border-[#dde1ea] bg-white px-4 hover:bg-[#f6f7fb]"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleApplyImport()}
              disabled={applyingImport || (preview?.summary.total === preview?.summary.invalid)}
              className="h-11 rounded-2xl px-4"
            >
              {applyingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Confirmar importacion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />
    </PageEntrance>
  );
}
