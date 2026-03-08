"use client";

import { useState } from "react";
import useSWR from "swr";
import type { PromptSection } from "@bottoo/shared";
import { fetcher, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Layers,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function SectionsTab() {
  const { data: sections, error, isLoading, mutate } = useSWR<PromptSection[]>("/agent/sections", fetcher);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleValue, setTitleValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const sorted = [...(sections ?? [])].sort((a, b) => a.order - b.order);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleToggleActive = async (section: PromptSection) => {
    setTogglingId(section.id);
    try {
      await api.put(`/agent/sections/${section.id}`, { is_active: !section.is_active });
      mutate();
      toast.success(section.is_active ? "Seccion desactivada" : "Seccion activada");
    } catch (err) {
      toast.error("Error al cambiar el estado de la seccion");
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleTitleSave = async (section: PromptSection) => {
    if (titleValue.trim() && titleValue !== section.title) {
      try {
        await api.put(`/agent/sections/${section.id}`, { title: titleValue.trim() });
        mutate();
        toast.success("Titulo actualizado");
      } catch (err) {
        toast.error("Error al guardar el titulo");
        console.error(err);
      }
    }
    setEditingTitle(null);
  };

  const handleContentSave = async (section: PromptSection, content: string) => {
    try {
      await api.put(`/agent/sections/${section.id}`, { content });
      mutate();
      toast.success("Contenido guardado");
    } catch (err) {
      toast.error("Error al guardar el contenido");
      console.error(err);
    }
  };

  const handleMoveUp = async (section: PromptSection, index: number) => {
    if (index === 0) return;
    setMovingId(section.id);
    try {
      const prev = sorted[index - 1];
      await api.put(`/agent/sections/${section.id}`, { order: prev.order });
      await api.put(`/agent/sections/${prev.id}`, { order: section.order });
      mutate();
    } catch (err) {
      toast.error("Error al mover la seccion");
      console.error(err);
    } finally {
      setMovingId(null);
    }
  };

  const handleMoveDown = async (section: PromptSection, index: number) => {
    if (index === sorted.length - 1) return;
    setMovingId(section.id);
    try {
      const next = sorted[index + 1];
      await api.put(`/agent/sections/${section.id}`, { order: next.order });
      await api.put(`/agent/sections/${next.id}`, { order: section.order });
      mutate();
    } catch (err) {
      toast.error("Error al mover la seccion");
      console.error(err);
    } finally {
      setMovingId(null);
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
      await api.delete(`/agent/sections/${deleteId}`);
      mutate();
      setDeleteOpen(false);
      setDeleteId(null);
      toast.success("Seccion eliminada");
    } catch (err) {
      toast.error("Error al eliminar la seccion");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await api.post("/agent/sections", {
        title: "Nueva Seccion",
        content: "",
        order: sorted.length + 1,
        is_active: true,
      });
      mutate();
      toast.success("Seccion creada");
    } catch (err) {
      toast.error("Error al crear la seccion");
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading && !sections) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Secciones</h2>
          <p className="mt-1 text-lg text-muted-foreground font-semibold">
            Administra las secciones del prompt del agente
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.map((section, idx) => (
          <Card
            key={section.id}
            className={cn(
              "rounded-2xl border-0 border-l-4 shadow-sm transition-all duration-200 overflow-hidden",
              section.is_active
                ? "border-l-green-500 shadow-md"
                : "border-l-gray-300 opacity-70"
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-2"
                    onClick={() => handleMoveUp(section, idx)}
                    disabled={idx === 0 || movingId === section.id}
                    aria-label="Mover seccion arriba"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-2"
                    onClick={() => handleMoveDown(section, idx)}
                    disabled={idx === sorted.length - 1 || movingId === section.id}
                    aria-label="Mover seccion abajo"
                  >
                    <ArrowDown className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 min-w-0">
                  {editingTitle === section.id ? (
                    <Input
                      autoFocus
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={() => handleTitleSave(section)}
                      onKeyDown={(e) => e.key === "Enter" && handleTitleSave(section)}
                      className="h-10 rounded-xl border-2 text-base font-bold max-w-xs"
                    />
                  ) : (
                    <button
                      className="text-lg font-bold hover:text-primary text-left flex-1 min-w-0 truncate transition-colors"
                      onClick={() => {
                        setEditingTitle(section.id);
                        setTitleValue(section.title);
                      }}
                    >
                      {section.title}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={section.is_active}
                      onCheckedChange={() => handleToggleActive(section)}
                      disabled={togglingId === section.id}
                      aria-label={section.is_active ? "Desactivar seccion" : "Activar seccion"}
                    />
                    <Label className="text-sm font-bold">
                      {togglingId === section.id ? "Cambiando..." : section.is_active ? "Activa" : "Inactiva"}
                    </Label>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-2"
                    onClick={() => toggleExpand(section.id)}
                    aria-label={expandedId === section.id ? "Colapsar seccion" : "Expandir seccion"}
                    aria-expanded={expandedId === section.id}
                  >
                    {expandedId === section.id ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => confirmDelete(section.id)}
                    aria-label="Eliminar seccion"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {expandedId === section.id && (
                <div className="mt-5 space-y-3">
                  <Textarea
                    defaultValue={section.content}
                    rows={8}
                    className="rounded-xl border-2 bg-amber-50/30 p-4 font-mono text-base"
                    onBlur={(e) => handleContentSave(section, e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Se guarda automaticamente al salir del campo
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add section card */}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 flex flex-col items-center gap-3 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 group"
        >
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <span className="text-lg font-bold text-primary">
            {adding ? "Creando..." : "Agregar Seccion"}
          </span>
        </button>

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <Layers className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-bold text-muted-foreground">
              No hay secciones. Crea una nueva para comenzar.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-red-600">
              Eliminar Seccion
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
              aria-label="Confirmar eliminacion de seccion"
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
