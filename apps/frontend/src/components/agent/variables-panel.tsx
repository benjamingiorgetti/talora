"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Variable } from "@talora/shared";
import { fetcher, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Variable as VariableIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface VariablesPanelProps {
  onInsertVariable: (key: string) => void;
}

interface VariableFormState {
  key: string;
  default_value: string;
  description: string;
}

const emptyForm: VariableFormState = {
  key: "",
  default_value: "",
  description: "",
};

function VariableRow({
  variable,
  onInsert,
  onEdit,
  onDelete,
}: {
  variable: Variable;
  onInsert: (key: string) => void;
  onEdit?: (v: Variable) => void;
  onDelete?: (v: Variable) => void;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(`{{${variable.key}}}`);
    toast.success(`Copiado: {{${variable.key}}}`);
  };

  return (
    <div className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors duration-100">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {`{{${variable.key}}}`}
          </span>
        </div>
        {variable.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
            {variable.description}
          </p>
        )}
        {variable.default_value && (
          <p className="mt-0.5 text-xs text-muted-foreground/60 font-mono truncate">
            = {variable.default_value}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100 shrink-0 pt-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          aria-label="Copiar variable"
          title="Copiar"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary hover:bg-primary/10"
          onClick={() => onInsert(variable.key)}
          aria-label="Insertar variable en el editor"
          title="Insertar en cursor"
        >
          <Plus className="h-3 w-3" />
        </Button>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(variable)}
            aria-label="Editar variable"
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(variable)}
            aria-label="Eliminar variable"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function VariablesPanel({ onInsertVariable }: VariablesPanelProps) {
  const {
    data: variables,
    error,
    isLoading,
    mutate,
  } = useSWR<Variable[]>("/agent/variables", fetcher);

  const [createOpen, setCreateOpen] = useState(false);
  const [editVariable, setEditVariable] = useState<Variable | null>(null);
  const [deleteVariable, setDeleteVariable] = useState<Variable | null>(null);
  const [form, setForm] = useState<VariableFormState>(emptyForm);
  const [isMutating, setIsMutating] = useState(false);

  const systemVars = variables?.filter((v) => v.category === "system") ?? [];
  const customVars = variables?.filter((v) => v.category === "custom") ?? [];

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (v: Variable) => {
    setForm({
      key: v.key,
      default_value: v.default_value,
      description: v.description,
    });
    setEditVariable(v);
  };

  const handleCreate = async () => {
    if (!form.key.trim()) {
      toast.error("El nombre de la variable es requerido");
      return;
    }
    setIsMutating(true);
    try {
      await api.post("/agent/variables", {
        key: form.key.trim(),
        default_value: form.default_value.trim(),
        description: form.description.trim(),
      });
      await mutate();
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Variable creada");
    } catch (err) {
      console.error(err);
      toast.error("Error al crear la variable");
    } finally {
      setIsMutating(false);
    }
  };

  const handleEdit = async () => {
    if (!editVariable || !form.key.trim()) return;
    setIsMutating(true);
    try {
      await api.put(`/agent/variables/${editVariable.id}`, {
        key: form.key.trim(),
        default_value: form.default_value.trim(),
        description: form.description.trim(),
      });
      await mutate();
      setEditVariable(null);
      toast.success("Variable actualizada");
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar la variable");
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteVariable) return;
    setIsMutating(true);
    try {
      await api.delete(`/agent/variables/${deleteVariable.id}`);
      await mutate();
      setDeleteVariable(null);
      toast.success("Variable eliminada");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar la variable");
    } finally {
      setIsMutating(false);
    }
  };

  if (error) return <ErrorCard onRetry={() => mutate()} />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <VariableIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold">Variables</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openCreate}
          className="h-7 text-xs border-dashed"
        >
          <Plus className="mr-1 h-3 w-3" />
          Nueva
        </Button>
      </div>

      {/* Variable list */}
      <ScrollArea className="flex-1">
        {isLoading && !variables ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {/* System variables */}
            {systemVars.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sistema
                </p>
                <div className="space-y-0.5">
                  {systemVars.map((v) => (
                    <VariableRow
                      key={v.id}
                      variable={v}
                      onInsert={onInsertVariable}
                    />
                  ))}
                </div>
              </div>
            )}

            {systemVars.length > 0 && customVars.length > 0 && (
              <Separator />
            )}

            {/* Custom variables */}
            {customVars.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom
                </p>
                <div className="space-y-0.5">
                  <AnimatePresence>
                    {customVars.map((v) => (
                      <motion.div
                        key={v.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                      >
                        <VariableRow
                          variable={v}
                          onInsert={onInsertVariable}
                          onEdit={openEdit}
                          onDelete={setDeleteVariable}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {!isLoading && systemVars.length === 0 && customVars.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <VariableIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No hay variables definidas
                </p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Variable</DialogTitle>
            <DialogDescription>
              Crea una variable personalizada para usar en el prompt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="var-key" className="text-xs">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="var-key"
                placeholder="nombre_variable"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    key: e.target.value.replace(/\s/g, "_"),
                  }))
                }
                className="h-8 text-sm font-mono"
              />
              {form.key && (
                <p className="text-xs text-muted-foreground font-mono">
                  {`{{${form.key}}}`}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="var-default" className="text-xs">
                Valor por defecto
              </Label>
              <Input
                id="var-default"
                placeholder="valor predeterminado"
                value={form.default_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_value: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="var-desc" className="text-xs">
                Descripcion
              </Label>
              <Input
                id="var-desc"
                placeholder="Para que se usa esta variable"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={isMutating || !form.key.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isMutating ? "Creando..." : "Crear Variable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editVariable}
        onOpenChange={(o) => !o && setEditVariable(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Variable</DialogTitle>
            <DialogDescription>
              Modifica los datos de la variable personalizada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="nombre_variable"
                value={form.key}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    key: e.target.value.replace(/\s/g, "_"),
                  }))
                }
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor por defecto</Label>
              <Input
                placeholder="valor predeterminado"
                value={form.default_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_value: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripcion</Label>
              <Input
                placeholder="Para que se usa esta variable"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditVariable(null)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={isMutating || !form.key.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isMutating ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteVariable}
        onOpenChange={(o) => !o && setDeleteVariable(null)}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Eliminar Variable
            </DialogTitle>
            <DialogDescription>
              Esta accion eliminara{" "}
              <span className="font-mono text-foreground">
                {`{{${deleteVariable?.key}}}`}
              </span>{" "}
              permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteVariable(null)}
              disabled={isMutating}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={isMutating}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {isMutating ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
