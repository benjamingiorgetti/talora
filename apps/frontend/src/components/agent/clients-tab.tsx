"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import type { Client } from "@talora/shared";
import { fetcher, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const CLIENT_TYPES = [
  { value: "cliente", label: "Cliente" },
  { value: "vip", label: "VIP" },
  { value: "mayorista", label: "Mayorista" },
  { value: "minorista", label: "Minorista" },
  { value: "distribuidor", label: "Distribuidor" },
];

interface ClientForm {
  phone_number: string;
  name: string;
  client_type: string;
  branch: string;
  delivery_days: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
}

const emptyForm: ClientForm = {
  phone_number: "",
  name: "",
  client_type: "cliente",
  branch: "",
  delivery_days: "",
  payment_terms: "",
  notes: "",
  is_active: true,
};

export function ClientsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const queryPath = debouncedSearch
    ? `/clients?search=${encodeURIComponent(debouncedSearch)}`
    : "/clients";

  const { data: clients, error, isLoading, mutate } = useSWR<Client[]>(queryPath, fetcher);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      phone_number: client.phone_number,
      name: client.name,
      client_type: client.client_type,
      branch: client.branch,
      delivery_days: client.delivery_days,
      payment_terms: client.payment_terms,
      notes: client.notes,
      is_active: client.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.phone_number.trim()) {
      toast.error("El numero de telefono es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/clients/${editingId}`, form);
      } else {
        await api.post("/clients", form);
      }
      await mutate();
      setDialogOpen(false);
      toast.success(editingId ? "Cliente actualizado" : "Cliente creado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg);
    } finally {
      setSaving(false);
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
      await api.delete(`/clients/${deleteId}`);
      mutate();
      setDeleteOpen(false);
      setDeleteId(null);
      toast.success("Cliente eliminado");
    } catch (err) {
      toast.error("Error al eliminar el cliente");
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading && !clients) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Clientes</h2>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Gestiona los clientes registrados y sus datos de contexto
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-9 rounded-lg px-4 text-sm font-medium"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre o telefono..."
          className="h-10 rounded-lg pl-10 text-sm"
        />
      </div>

      {/* Table */}
      {clients && clients.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Nombre</TableHead>
                <TableHead className="text-xs font-semibold">Telefono</TableHead>
                <TableHead className="text-xs font-semibold">Tipo</TableHead>
                <TableHead className="text-xs font-semibold">Sucursal</TableHead>
                <TableHead className="text-xs font-semibold">Estado</TableHead>
                <TableHead className="text-xs font-semibold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="text-sm font-medium">
                    {client.name || <span className="text-muted-foreground italic">Sin nombre</span>}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {client.phone_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded text-xs font-medium">
                      {client.client_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {client.branch || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        client.is_active
                          ? "rounded text-xs font-medium bg-green-500/10 text-green-400 border-green-500/20"
                          : "rounded text-xs font-medium bg-red-500/10 text-red-400 border-red-500/20"
                      }
                    >
                      {client.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => openEdit(client)}
                        aria-label="Editar cliente"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => confirmDelete(client.id)}
                        aria-label="Eliminar cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-base font-semibold text-muted-foreground">
            {debouncedSearch ? "No se encontraron clientes" : "No hay clientes registrados"}
          </p>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ? "Intenta con otro termino de busqueda" : "Crea un nuevo cliente para empezar"}
          </p>
          {!debouncedSearch && (
            <Button
              onClick={openCreate}
              className="mt-5 h-9 rounded-lg px-4 text-sm font-medium"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Cliente
            </Button>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingId ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifica los datos de este cliente"
                : "Los datos del cliente se inyectan como contexto en el prompt"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Telefono *</Label>
                <Input
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="5491155551234"
                  className="h-10 rounded-lg text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Juan Perez"
                  className="h-10 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Tipo de cliente</Label>
                <Select
                  value={form.client_type}
                  onValueChange={(v) => setForm({ ...form, client_type: v })}
                >
                  <SelectTrigger className="h-10 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sucursal</Label>
                <Input
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder="Centro"
                  className="h-10 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Dias de entrega</Label>
                <Input
                  value={form.delivery_days}
                  onChange={(e) => setForm({ ...form, delivery_days: e.target.value })}
                  placeholder="lunes, miercoles"
                  className="h-10 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Condicion de pago</Label>
                <Input
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  placeholder="30 dias"
                  className="h-10 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Notas</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observaciones sobre el cliente..."
                rows={3}
                className="rounded-lg text-sm p-3"
              />
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label className="text-sm font-medium">
                {form.is_active ? "Activo" : "Inactivo"}
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
              disabled={saving || !form.phone_number.trim()}
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
              Eliminar Cliente
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
              aria-label="Confirmar eliminacion de cliente"
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
