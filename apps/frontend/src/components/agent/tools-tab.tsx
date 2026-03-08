"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AgentTool } from "@talora/shared";
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
  { value: "google_calendar_check", label: "Google Calendar - Consultar", icon: Calendar, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "google_calendar_book", label: "Google Calendar - Reservar", icon: CalendarPlus, color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { value: "google_calendar_cancel", label: "Google Calendar - Cancelar", icon: CalendarX, color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "webhook", label: "Webhook", icon: Webhook, color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Herramientas</h2>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Configura las herramientas disponibles para el agente
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-9 rounded-lg px-4 text-sm font-medium"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Herramienta
        </Button>
      </div>

      <div className="space-y-3">
        {tools?.map((tool) => {
          const implConfig = getImplConfig(tool.implementation);
          const Icon = implConfig.icon;

          return (
            <div key={tool.id}>
              <Card
                className={cn(
                  "rounded-lg border border-border",
                  !tool.is_active && "opacity-60"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0 border", implConfig.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold">{tool.name}</span>
                        <Badge
                          variant="outline"
                          className={cn("rounded text-xs font-medium px-2 border", implConfig.color)}
                        >
                          {implConfig.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tool.is_active}
                          onCheckedChange={() => handleToggle(tool)}
                          disabled={togglingId === tool.id}
                          aria-label={tool.is_active ? "Desactivar herramienta" : "Activar herramienta"}
                        />
                        <Label className="text-xs font-medium text-muted-foreground">
                          {togglingId === tool.id ? "Cambiando..." : tool.is_active ? "Activa" : "Inactiva"}
                        </Label>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => openEdit(tool)}
                        aria-label="Editar herramienta"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => confirmDelete(tool.id)}
                        aria-label="Eliminar herramienta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}

        {(!tools || tools.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20">
            <Wrench className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-base font-semibold text-muted-foreground">
              No hay herramientas configuradas
            </p>
            <p className="text-sm text-muted-foreground">
              Crea una nueva herramienta para empezar
            </p>
            <Button
              onClick={openCreate}
              className="mt-5 h-9 rounded-lg px-4 text-sm font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Herramienta
            </Button>
          </div>
        )}
      </div>

      {/* Tool Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingId ? "Editar Herramienta" : "Nueva Herramienta"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifica la configuracion de esta herramienta"
                : "Configura una nueva herramienta para el agente"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="check_availability"
                className="h-10 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Descripcion</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Verifica la disponibilidad de turnos..."
                rows={3}
                className="rounded-lg text-sm p-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Parametros (JSON Schema)</Label>
              <Textarea
                value={form.parameters}
                onChange={(e) => {
                  setForm({ ...form, parameters: e.target.value });
                  setFormError("");
                }}
                className={cn(
                  "rounded-lg font-mono text-sm p-3",
                  formError && "border-red-400 bg-red-50"
                )}
                rows={6}
              />
              {formError && (
                <p className="text-xs font-medium text-red-500">{formError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de implementacion</Label>
              <div className="grid grid-cols-2 gap-2">
                {IMPL_TYPES.map((t) => {
                  const ImplIcon = t.icon;
                  const isSelected = form.implementation === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, implementation: t.value })}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <ImplIcon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-xs font-medium", isSelected ? "text-primary" : "text-foreground")}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label className="text-sm font-medium">
                {form.is_active ? "Activa" : "Inactiva"}
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-10 rounded-lg text-sm font-medium"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="h-10 rounded-lg text-sm font-medium"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-red-600">
              Eliminar Herramienta
            </DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-10 rounded-lg text-sm font-medium flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={!!deletingId}
              className="h-10 rounded-lg bg-red-500 text-sm font-medium text-white hover:bg-red-600 flex-1"
              aria-label="Confirmar eliminacion de herramienta"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deletingId ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
