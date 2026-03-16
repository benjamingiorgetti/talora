"use client";

import { useEffect, useState } from "react";
import type { Professional, Service } from "@talora/shared";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface ServiceFormData {
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
  professional_id: string | null;
  is_active: boolean;
}

interface ServiceEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  service: Service | null;
  professionals: Professional[];
  onSave: (data: ServiceFormData) => Promise<void>;
  onDelete?: (serviceId: string) => Promise<void>;
}

function parsePriceInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

export function ServiceEditorSheet({
  open,
  onOpenChange,
  mode,
  service,
  professionals,
  onSave,
  onDelete,
}: ServiceEditorSheetProps) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [professionalId, setProfessionalId] = useState("all");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (mode === "edit" && service) {
      setName(service.name);
      setDurationMinutes(String(service.duration_minutes));
      setPrice(String(service.price));
      setDescription(service.description ?? "");
      setProfessionalId(service.professional_id ?? "all");
      setIsActive(service.is_active !== false);
    } else {
      setName("");
      setDurationMinutes("60");
      setPrice("");
      setDescription("");
      setProfessionalId("all");
      setIsActive(true);
    }
    setConfirmDelete(false);
  }, [mode, service, open]);

  const handleSave = async () => {
    const parsedPrice = parsePriceInput(price);
    if (!name.trim() || parsedPrice === null) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        duration_minutes: Number(durationMinutes) || 60,
        price: parsedPrice,
        description: description.trim(),
        professional_id: professionalId === "all" ? null : professionalId,
        is_active: isActive,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!service || !onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(service.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const canSave = name.trim().length > 0 && parsePriceInput(price) !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden">
        <SheetHeader className="border-b border-[#f0f1f5]">
          <SheetTitle className="font-display text-xl tracking-[-0.03em]">
            {mode === "create" ? "Nuevo servicio" : "Editar servicio"}
          </SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Completa los datos del servicio para agregarlo al catalogo."
              : service?.name ?? ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="service-name">Nombre</Label>
              <Input
                id="service-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-2xl border-[#e6dccb]"
                placeholder="Consulta inicial"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service-duration">Duracion (min)</Label>
                <Input
                  id="service-duration"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="h-11 rounded-2xl border-[#e6dccb]"
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price">Precio</Label>
                <Input
                  id="service-price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-11 rounded-2xl border-[#e6dccb]"
                  placeholder="25000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profesional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger className="h-11 rounded-2xl border-[#e6dccb]">
                  <SelectValue placeholder="Disponible para todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Disponible para todos</SelectItem>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Descripcion</Label>
              <Textarea
                id="service-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] rounded-2xl border-[#e6dccb]"
                placeholder="Descripcion para el equipo"
                rows={3}
              />
            </div>

            {mode === "edit" && (
              <div className="flex items-center justify-between rounded-2xl border border-[#f0f1f5] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Activo</p>
                  <p className="text-xs text-slate-500">Visible para agenda y WhatsApp</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>
        </div>

        <SheetFooter
          className={mode === "edit" ? "sm:justify-between" : ""}
        >
          {mode === "edit" && onDelete && (
            <Button
              variant="outline"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="h-11 rounded-2xl border-[#edd6d3] bg-white px-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {confirmDelete ? "Confirmar" : "Eliminar"}
            </Button>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
            className={`h-11 rounded-2xl px-5 ${mode === "create" ? "w-full" : ""}`}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Agregar servicio
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
