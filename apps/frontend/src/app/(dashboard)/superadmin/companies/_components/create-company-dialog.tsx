"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { verticalOptions } from "./types";

type CompanyForm = {
  name: string;
  industry: string;
  whatsapp: string;
  escalationNumber: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

export function CreateCompanyDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  creating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CompanyForm;
  onFormChange: (updater: (current: CompanyForm) => CompanyForm) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl bg-[#17352d] px-5 hover:bg-[#21453a]">
          <Plus className="mr-2 h-4 w-4" />
          Crear empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Crear nueva empresa</DialogTitle>
          <DialogDescription>Completa los datos basicos para la nueva cuenta.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.name} onChange={(event) => onFormChange((c) => ({ ...c, name: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="Clinica Armonia Dental" />
          </div>
          <div className="space-y-2">
            <Label>Rubro</Label>
            <Select value={form.industry} onValueChange={(value) => onFormChange((c) => ({ ...c, industry: value }))}>
              <SelectTrigger className="h-11 rounded-2xl border-[#dde1ea]">
                <SelectValue placeholder="Selecciona un vertical" />
              </SelectTrigger>
              <SelectContent>
                {verticalOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>WhatsApp principal</Label>
              <Input value={form.whatsapp} onChange={(event) => onFormChange((c) => ({ ...c, whatsapp: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="+54 9 11..." />
            </div>
            <div className="space-y-2">
              <Label>Numero de escalacion</Label>
              <Input value={form.escalationNumber} onChange={(event) => onFormChange((c) => ({ ...c, escalationNumber: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="+54 9 11..." />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Admin nombre</Label>
              <Input value={form.adminFullName} onChange={(event) => onFormChange((c) => ({ ...c, adminFullName: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="Juliana Perez" />
            </div>
            <div className="space-y-2">
              <Label>Admin email</Label>
              <Input value={form.adminEmail} onChange={(event) => onFormChange((c) => ({ ...c, adminEmail: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="equipo@clinica.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password temporal</Label>
            <Input type="password" value={form.adminPassword} onChange={(event) => onFormChange((c) => ({ ...c, adminPassword: event.target.value }))} className="h-11 rounded-2xl border-[#dde1ea]" placeholder="••••••••" />
          </div>
          <Button disabled={creating} onClick={onCreate} className="mt-2 h-11 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Creando..." : "Crear empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
