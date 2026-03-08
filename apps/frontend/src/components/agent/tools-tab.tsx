"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AgentTool } from "@bottoo/shared";
import { fetcher, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  CalendarPlus,
  CalendarX,
  Webhook,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const IMPL_TYPES = [
  { value: "google_calendar_check", label: "Google Calendar - Consultar", icon: Calendar, color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "google_calendar_book", label: "Google Calendar - Reservar", icon: CalendarPlus, color: "bg-green-100 text-green-700 border-green-200" },
  { value: "google_calendar_cancel", label: "Google Calendar - Cancelar", icon: CalendarX, color: "bg-red-100 text-red-700 border-red-200" },
  { value: "webhook", label: "Webhook", icon: Webhook, color: "bg-purple-100 text-purple-700 border-purple-200" },
];

function getImplConfig(impl: string) {
  return IMPL_TYPES.find((t) => t.value === impl) ?? IMPL_TYPES[3];
}

interface ToolForm {
  name: string;
  description: string;
  parameters: string;
  implementation: string;
  is_active: boolean;
}

const emptyForm: ToolForm = {
  name: "",
  description: "",
  parameters: "{}",
  implementation: "webhook",
  is_active: true,
};

export function ToolsTab() {
  const { data: tools, error, isLoading, mutate } = useSWR<AgentTool[]>("/agent/tools", fetcher);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (tool: AgentTool) => {
    setEditingId(tool.id);
    setForm({
      name: tool.name,
      description: tool.description,
      parameters: JSON.stringify(tool.parameters, null, 2),
      implementation: tool.implementation,
      is_active: tool.is_active,
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError("");
    try {
      let params: Record<string, unknown> = {};
      try {
        params = JSON.parse(form.parameters);
      } catch {
        setFormError("JSON de parametros invalido");
        setSaving(false);
        return;
      }

      const body = {
        name: form.name,
        description: form.description,
        parameters: params,
        implementation: form.implementation,
        is_active: form.is_active,
      };

      if (editingId) {
        await api.put(`/agent/tools/${editingId}`, body);
      } else {
        await api.post("/agent/tools", body);
      }
      await mutate();
      setDialogOpen(false);
      toast.success(editingId ? "Herramienta actualizada" : "Herramienta creada");
    } catch (err) {
      toast.error(editingId ? "Error al actualizar la herramienta" : "Error al crear la herramienta");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (tool: AgentTool) => {
    setTogglingId(tool.id);
    try {
      await api.put(`/agent/tools/${tool.id}`, { is_active: !tool.is_active });
      mutate();
      toast.success(tool.is_active ? "Herramienta desactivada" : "Herramienta activada");
    } catch (err) {
      toast.error("Error al cambiar el estado de la herramienta");
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeletingId(deleteId);
    try {
      await api.delete(`/agent/tools/${deleteId}`);
      mutate();
      setDeleteOpen(false);
      setDeleteId(null);
      toast.success("Herramienta eliminada");
    } catch (err) {
      toast.error("Error al eliminar la herramienta");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading && !tools) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Herramientas</h2>
          <p className="mt-1 text-lg text-muted-foreground font-semibold">
            Configura las herramientas disponibles para el agente
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-12 rounded-xl px-6 text-base font-bold"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nueva Herramienta
        </Button>
      </div>

      <div className="space-y-4">
        {tools?.map((tool) => {
          const implConfig = getImplConfig(tool.implementation);
          const Icon = implConfig.icon;

          return (
            <Card
              key={tool.id}
              className={cn(
                "rounded-2xl border-0 shadow-sm hover-lift transition-all duration-200",
                !tool.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-5">
                  <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shrink-0", implConfig.color)}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-bold">{tool.name}</span>
                      <Badge
                        variant="outline"
                        className={cn("rounded-full font-bold px-3", implConfig.color)}
                      >
                        {implConfig.label}
                      </Badge>
                    </div>
                    <p className="text-base text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tool.is_active}
                        onCheckedChange={() => handleToggle(tool)}
                        disabled={togglingId === tool.id}
                        aria-label={tool.is_active ? "Desactivar herramienta" : "Activar herramienta"}
                      />
                      <Label className="text-sm font-bold">
                        {togglingId === tool.id ? "Cambiando..." : tool.is_active ? "Activa" : "Inactiva"}
                      </Label>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2"
                      onClick={() => openEdit(tool)}
                      aria-label="Editar herramienta"
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => confirmDelete(tool.id)}
                      aria-label="Eliminar herramienta"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!tools || tools.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20">
            <Wrench className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-bold text-muted-foreground">
              No hay herramientas configuradas
            </p>
            <p className="text-muted-foreground">
              Crea una nueva herramienta para empezar
            </p>
            <Button
              onClick={openCreate}
              className="mt-6 h-12 rounded-xl px-6 text-base font-bold"
            >
              <Plus className="mr-2 h-5 w-5" />
              Crear Herramienta
            </Button>
          </div>
        )}
      </div>

      {/* Tool Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold">
              {editingId ? "Editar Herramienta" : "Nueva Herramienta"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {editingId
                ? "Modifica la configuracion de esta herramienta"
                : "Configura una nueva herramienta para el agente"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-base font-bold">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="check_availability"
                className="h-12 rounded-xl border-2 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-bold">Descripcion</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Verifica la disponibilidad de turnos..."
                rows={3}
                className="rounded-xl border-2 text-base p-4"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-bold">Parametros (JSON Schema)</Label>
              <Textarea
                value={form.parameters}
                onChange={(e) => {
                  setForm({ ...form, parameters: e.target.value });
                  setFormError("");
                }}
                className={cn(
                  "rounded-xl border-2 font-mono text-sm p-4",
                  formError && "border-red-400 bg-red-50"
                )}
                rows={6}
              />
              {formError && (
                <p className="text-sm font-bold text-red-500">{formError}</p>
              )}
            </div>
            <div className="space-y-3">
              <Label className="text-base font-bold">Tipo de implementacion</Label>
              <div className="grid grid-cols-2 gap-3">
                {IMPL_TYPES.map((t) => {
                  const ImplIcon = t.icon;
                  const isSelected = form.implementation === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, implementation: t.value })}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <ImplIcon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-sm font-bold", isSelected ? "text-primary" : "text-foreground")}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label className="text-base font-bold">
                {form.is_active ? "Activa" : "Inactiva"}
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-12 rounded-xl border-2 text-base font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="h-12 rounded-xl text-base font-bold"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-red-600">
              Eliminar Herramienta
            </DialogTitle>
            <DialogDescription className="text-base">
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-12 rounded-xl border-2 text-base font-bold flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!!deletingId}
              className="h-12 rounded-xl bg-red-500 text-base font-bold text-white hover:bg-red-600 flex-1"
              aria-label="Confirmar eliminacion de herramienta"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              {deletingId ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
